"""Build customer → project → card → batch workspace tree."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import BomLine, BomVersion, Customer, Project, ProjectCard, User
from app.services.bom_quality import compute_required_qty, reanalyze_bom_version_quality
from app.services.project_status import (
    CARD_STATUS_NEW,
    normalize_card_status,
    normalize_project_status,
    sync_project_status_from_cards,
)

CLOSED_BATCH_STATUSES = frozenset({"archived", "closed", "complete", "inactive"})


def _batch_row_fields(
    db: Session,
    version: BomVersion,
    *,
    users_by_id: dict[int, str],
) -> dict:
    lines = list(db.scalars(select(BomLine).where(BomLine.bom_version_id == version.id)))
    bom_items_count = sum(1 for line in lines if not line.dnp)
    line_updated = max((line.updated_at for line in lines), default=None)

    opened_at = version.imported_at or version.created_at
    updated_at = line_updated or version.imported_at or version.created_at
    is_closed = version.status.strip().lower() in CLOSED_BATCH_STATUSES
    closed_at = updated_at if is_closed else None

    user_id = version.imported_by_user_id or version.created_by_id
    updated_by_name = users_by_id.get(user_id) if user_id else None

    return {
        "bom_items_count": bom_items_count,
        "batch_status": version.status,
        "opened_at": opened_at,
        "closed_at": closed_at,
        "updated_at": updated_at,
        "updated_by_user_id": user_id,
        "updated_by_name": updated_by_name,
    }


def _matches_query(*, q: str, parts: list[str | None]) -> bool:
    if not q:
        return True
    needle = q.strip().lower()
    if not needle:
        return True
    hay = " ".join(p for p in parts if p).lower()
    return needle in hay


def build_workspace(db: Session, *, q: str | None = None) -> dict:
    customers = list(db.scalars(select(Customer).order_by(Customer.name, Customer.id)))
    projects = list(
        db.scalars(
            select(Project).where(Project.deleted_at.is_(None)).order_by(Project.name, Project.id)
        )
    )
    cards = list(db.scalars(select(ProjectCard).order_by(ProjectCard.name, ProjectCard.id)))
    versions = list(db.scalars(select(BomVersion).order_by(BomVersion.id)))
    users_by_id = {
        u.id: u.name for u in db.scalars(select(User).where(User.is_active.is_(True)))
    }

    needs_review_total = (
        db.scalar(
            select(func.count(BomLine.id))
            .join(BomVersion, BomVersion.id == BomLine.bom_version_id)
            .join(Project, Project.id == BomVersion.project_id)
            .where(Project.deleted_at.is_(None), BomLine.needs_review.is_(True))
        )
        or 0
    )

    cards_by_project: dict[int, list[ProjectCard]] = {}
    for card in cards:
        cards_by_project.setdefault(card.project_id, []).append(card)

    versions_by_card: dict[int, list[BomVersion]] = {}
    for version in versions:
        if version.card_id is not None:
            versions_by_card.setdefault(version.card_id, []).append(version)

    projects_by_customer: dict[int, list[Project]] = {}
    for project in projects:
        projects_by_customer.setdefault(project.customer_id, []).append(project)

    batch_rows: list[dict] = []
    tree_customers: list[dict] = []
    needle = (q or "").strip()

    for customer in customers:
        customer_projects: list[dict] = []
        for project in projects_by_customer.get(customer.id, []):
            project_cards: list[dict] = []
            card_list = cards_by_project.get(project.id, [])
            for card in card_list:
                card_batches: list[dict] = []
                for version in versions_by_card.get(card.id, []):
                    batch_label = (
                        version.batch_label or version.version_name or version.version_label
                    )
                    if not _matches_query(
                        q=needle,
                        parts=[
                            customer.name,
                            customer.code,
                            project.name,
                            project.code,
                            card.name,
                            card.code,
                            card.board_name,
                            batch_label,
                            version.version_label,
                            version.version_name,
                        ],
                    ):
                        continue
                    metrics = _batch_row_fields(db, version, users_by_id=users_by_id)
                    row = {
                        "batch_id": version.id,
                        "batch_label": batch_label,
                        "card_id": card.id,
                        "card_name": card.name,
                        "card_board_name": card.board_name,
                        "project_id": project.id,
                        "project_name": project.name,
                        "project_code": project.code,
                        "project_status": project.status,
                        "drive_folder_url": project.drive_folder_url,
                        "customer_id": customer.id,
                        "customer_name": customer.name,
                        "bom_version_label": version.version_label,
                        "bom_version_name": version.version_name,
                        "is_active_batch": project.active_version_id == version.id,
                        **metrics,
                    }
                    card_batches.append(row)
                    batch_rows.append(row)

                if card_batches or (
                    not needle
                    or _matches_query(
                        q=needle,
                        parts=[customer.name, project.name, card.name, card.board_name],
                    )
                ):
                    project_cards.append(
                        {
                            "id": card.id,
                            "name": card.name,
                            "code": card.code,
                            "board_name": card.board_name,
                            "status": normalize_card_status(card.status),
                            "build_quantity": card.build_quantity,
                            "batches": card_batches,
                        }
                    )

            if project_cards or (
                not needle
                or _matches_query(q=needle, parts=[customer.name, project.name, project.code])
            ):
                customer_projects.append(
                    {
                        "id": project.id,
                        "name": project.name,
                        "code": project.code,
                        "status": normalize_project_status(project.status),
                        "drive_folder_url": project.drive_folder_url,
                        "cards": project_cards,
                    }
                )

        if customer_projects or (
            not needle or _matches_query(q=needle, parts=[customer.name, customer.code])
        ):
            tree_customers.append(
                {
                    "id": customer.id,
                    "name": customer.name,
                    "code": customer.code,
                    "projects": customer_projects,
                }
            )

    if needle:
        batch_rows = [
            row
            for row in batch_rows
            if _matches_query(
                q=needle,
                parts=[
                    row["customer_name"],
                    row["project_name"],
                    row["project_code"],
                    row["card_name"],
                    row["batch_label"],
                ],
            )
        ]

    active_projects = sum(
        1 for p in projects if normalize_project_status(p.status) == "ACTIVE"
    )
    new_projects = sum(
        1 for p in projects if normalize_project_status(p.status) == "NEW"
    )

    return {
        "summary": {
            "customer_count": len(customers),
            "project_count": len(projects),
            "card_count": len(cards),
            "batch_count": len(batch_rows),
            "active_projects": active_projects,
            "in_review_projects": new_projects,
            "needs_review_total": int(needs_review_total),
        },
        "customers": tree_customers,
        "batches": batch_rows,
    }


def create_project_card(
    db: Session,
    *,
    project_id: int,
    name: str,
    code: str | None = None,
    board_name: str | None = None,
    status: str = CARD_STATUS_NEW,
    build_quantity: int = 1,
    notes: str | None = None,
) -> ProjectCard:
    project = db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise ValueError("Project not found")
    card = ProjectCard(
        project_id=project_id,
        name=name.strip(),
        code=(code or "").strip() or None,
        board_name=(board_name or "").strip() or None,
        status=normalize_card_status(status or CARD_STATUS_NEW),
        build_quantity=build_quantity if build_quantity > 0 else 1,
        notes=notes,
    )
    db.add(card)
    db.flush()
    sync_project_status_from_cards(db, project)
    return card


def _copy_bom_lines(
    db: Session,
    *,
    from_version_id: int,
    to_version: BomVersion,
    build_quantity: int,
) -> int:
    source = db.get(BomVersion, from_version_id)
    if source is None:
        raise ValueError("Source batch not found")

    source_lines = list(
        db.scalars(
            select(BomLine)
            .where(BomLine.bom_version_id == from_version_id)
            .order_by(BomLine.line_no, BomLine.id)
        )
    )
    if not source_lines:
        return 0

    for field in (
        "revision_code",
        "source_doc_number",
        "board_name",
        "revised_date",
        "bom_type",
        "source_file_name",
    ):
        if getattr(source, field, None) and not getattr(to_version, field, None):
            setattr(to_version, field, getattr(source, field))

    inserted = 0
    for idx, line in enumerate(source_lines, start=1):
        inserted += 1
        db.add(
            BomLine(
                bom_version_id=to_version.id,
                line_no=idx,
                mpn=line.mpn,
                cleaned_mpn=line.cleaned_mpn,
                manufacturer=line.manufacturer,
                description=line.description,
                quantity=line.quantity,
                required_qty=compute_required_qty(line.quantity, build_quantity, line.dnp),
                reference_designators=line.reference_designators,
                unit=line.unit,
                customer_price=line.customer_price,
                internal_cost=line.internal_cost,
                is_critical=line.is_critical,
                footprint=line.footprint,
                value=line.value,
                supplier_part_number=line.supplier_part_number,
                dnp=line.dnp,
                notes=line.notes,
                needs_review=line.needs_review,
                review_reason=line.review_reason,
                quality_status=line.quality_status,
            )
        )
    return inserted


def create_card_batch(
    db: Session,
    *,
    card_id: int,
    batch_label: str | None = None,
    build_quantity: int | None = None,
    notes: str | None = None,
    copy_from_version_id: int | None = None,
    set_active: bool = True,
    user_id: int | None = None,
) -> BomVersion:
    card = db.get(ProjectCard, card_id)
    if card is None:
        raise ValueError("Card not found")
    project = db.get(Project, card.project_id)
    if project is None or project.deleted_at is not None:
        raise ValueError("Project not found")

    existing = list(
        db.scalars(select(BomVersion).where(BomVersion.card_id == card_id).order_by(BomVersion.id))
    )
    next_idx = len(existing) + 1
    label = (batch_label or "").strip() or f"מנה {next_idx}"
    version = BomVersion(
        project_id=project.id,
        card_id=card.id,
        batch_label=label,
        version_label=label,
        version_name=label,
        status="Draft",
        source="copy" if copy_from_version_id else "manual",
        is_active=set_active,
        build_quantity=build_quantity or card.build_quantity,
        board_name=card.board_name,
        notes=notes,
        created_by_id=user_id,
    )
    db.add(version)
    db.flush()

    if copy_from_version_id is not None:
        src = db.get(BomVersion, copy_from_version_id)
        if src is None or src.card_id != card.id:
            raise ValueError("מקור ההעתקה חייב להיות מנה מאותו כרטיס")
        _copy_bom_lines(
            db,
            from_version_id=copy_from_version_id,
            to_version=version,
            build_quantity=version.build_quantity or card.build_quantity,
        )
        reanalyze_bom_version_quality(db, version.id)

    if set_active:
        db.query(BomVersion).filter(
            BomVersion.project_id == project.id,
            BomVersion.id != version.id,
        ).update({BomVersion.is_active: False})
        project.active_version_id = version.id
        version.is_active = True

    return version
