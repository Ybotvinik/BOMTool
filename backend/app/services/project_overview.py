"""Project overview context: cards and batches for scope selection."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import BomLine, BomVersion, Customer, Project, ProjectCard
from app.services.project_status import normalize_card_status, normalize_project_status


def build_project_overview(db: Session, project_id: int) -> dict:
    project = db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise ValueError("Project not found")

    customer = db.get(Customer, project.customer_id)
    cards = list(
        db.scalars(
            select(ProjectCard)
            .where(ProjectCard.project_id == project.id)
            .order_by(ProjectCard.name, ProjectCard.id)
        )
    )
    versions = list(
        db.scalars(
            select(BomVersion)
            .where(BomVersion.project_id == project.id)
            .order_by(BomVersion.id)
        )
    )
    versions_by_card: dict[int, list[BomVersion]] = {}
    for version in versions:
        if version.card_id is not None:
            versions_by_card.setdefault(version.card_id, []).append(version)

    line_counts: dict[int, int] = {}
    if versions:
        rows = db.execute(
            select(BomLine.bom_version_id, func.count(BomLine.id))
            .where(
                BomLine.bom_version_id.in_([v.id for v in versions]),
                BomLine.dnp.is_(False),
            )
            .group_by(BomLine.bom_version_id)
        )
        line_counts = {int(vid): int(cnt) for vid, cnt in rows.all()}

    card_payloads: list[dict] = []
    for card in cards:
        batches: list[dict] = []
        for version in versions_by_card.get(card.id, []):
            label = version.batch_label or version.version_name or version.version_label
            batches.append(
                {
                    "id": version.id,
                    "batch_label": label,
                    "version_label": version.version_label,
                    "version_name": version.version_name,
                    "status": version.status,
                    "build_quantity": version.build_quantity,
                    "bom_items_count": line_counts.get(version.id, 0),
                    "is_project_active": project.active_version_id == version.id,
                }
            )
        card_payloads.append(
            {
                "id": card.id,
                "name": card.name,
                "board_name": card.board_name,
                "status": normalize_card_status(card.status),
                "build_quantity": card.build_quantity,
                "batches": batches,
            }
        )

    return {
        "customer_id": project.customer_id,
        "customer_name": customer.name if customer else "",
        "project_id": project.id,
        "project_name": project.name,
        "project_code": project.code,
        "project_status": normalize_project_status(project.status),
        "active_version_id": project.active_version_id,
        "cards": card_payloads,
    }
