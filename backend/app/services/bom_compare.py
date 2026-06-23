"""Compare two BOM versions by designator, then MPN+manufacturer."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    BomLine,
    BomVersion,
    Customer,
    OfficialPriceSnapshot,
    Project,
)
from app.schemas.bom_compare import (
    BomCompareChangeRow,
    BomCompareResponse,
    BomCompareSummary,
    BomVersionCatalogItem,
    BomVersionCatalogResponse,
)
from app.schemas.bom_version import BomVersionRead
from app.services.bom_quality import compute_quality_summary, parse_refdes

CHANGE_ADDED = "Added"
CHANGE_REMOVED = "Removed"
CHANGE_UNCHANGED = "Unchanged"
CHANGE_QTY = "Quantity Changed"
CHANGE_MPN = "MPN Changed"
CHANGE_MFR = "Manufacturer Changed"
CHANGE_DESC = "Description Changed"
CHANGE_DNP = "DNP Changed"
CHANGE_CHANGED = "Changed"


def _norm_mpn(value: str | None) -> str:
    if not value:
        return ""
    return " ".join(str(value).strip().lower().split())


def _norm_mfr(value: str | None) -> str:
    if not value:
        return ""
    return str(value).strip().lower()


def _norm_desc(value: str | None) -> str:
    if not value:
        return ""
    return " ".join(str(value).strip().split())


def _refdes_set(line: BomLine) -> set[str]:
    return set(parse_refdes(line.reference_designators))


def _display_designator(base: BomLine | None, target: BomLine | None) -> str | None:
    for ln in (target, base):
        if ln and ln.reference_designators:
            return ln.reference_designators
    return None


def _qty_value(line: BomLine | None) -> float | None:
    if line is None or line.quantity is None:
        return None
    return float(line.quantity)


def _mpn_key(line: BomLine) -> tuple[str, str]:
    return (_norm_mpn(line.mpn), _norm_mfr(line.manufacturer))


def _intersection_size(a: set[str], b: set[str]) -> int:
    if not a or not b:
        return 0
    return len(a & b)


def _pair_lines(
    base_lines: list[BomLine], target_lines: list[BomLine]
) -> tuple[list[tuple[BomLine | None, BomLine | None]], list[BomLine], list[BomLine]]:
    base_pool = list(base_lines)
    target_pool = list(target_lines)
    pairs: list[tuple[BomLine | None, BomLine | None]] = []

    while base_pool:
        best_idx: int | None = None
        best_score = 0
        best_base_idx = 0
        for bi, base in enumerate(base_pool):
            base_set = _refdes_set(base)
            if not base_set:
                continue
            for ti, target in enumerate(target_pool):
                score = _intersection_size(base_set, _refdes_set(target))
                if score > best_score:
                    best_score = score
                    best_base_idx = bi
                    best_idx = ti
        if best_idx is None or best_score == 0:
            break
        base = base_pool.pop(best_base_idx)
        target = target_pool.pop(best_idx)
        pairs.append((base, target))

    while base_pool:
        best_idx: int | None = None
        best_base_idx = 0
        base_key = _mpn_key(base_pool[0])
        if not base_key[0]:
            break
        for ti, target in enumerate(target_pool):
            if _mpn_key(target) == base_key:
                best_idx = ti
                break
        if best_idx is None:
            break
        base = base_pool.pop(0)
        target = target_pool.pop(best_idx)
        pairs.append((base, target))

    for base in base_pool:
        pairs.append((base, None))
    for target in target_pool:
        pairs.append((None, target))

    return pairs, [], []


def _change_flags(base: BomLine | None, target: BomLine | None) -> list[str]:
    if base is None:
        return [CHANGE_ADDED]
    if target is None:
        return [CHANGE_REMOVED]

    flags: list[str] = []
    if _norm_mpn(base.mpn) != _norm_mpn(target.mpn):
        flags.append(CHANGE_MPN)
    if _norm_mfr(base.manufacturer) != _norm_mfr(target.manufacturer):
        flags.append(CHANGE_MFR)
    if _qty_value(base) != _qty_value(target):
        flags.append(CHANGE_QTY)
    if bool(base.dnp) != bool(target.dnp):
        flags.append(CHANGE_DNP)
    if _norm_desc(base.description) != _norm_desc(target.description):
        flags.append(CHANGE_DESC)
    if not flags:
        flags.append(CHANGE_UNCHANGED)
    return flags


def _primary_change_type(flags: list[str]) -> str:
    if CHANGE_ADDED in flags:
        return CHANGE_ADDED
    if CHANGE_REMOVED in flags:
        return CHANGE_REMOVED
    if CHANGE_UNCHANGED in flags and len(flags) == 1:
        return CHANGE_UNCHANGED
    priority = [
        CHANGE_MPN,
        CHANGE_MFR,
        CHANGE_QTY,
        CHANGE_DNP,
        CHANGE_DESC,
    ]
    for p in priority:
        if p in flags:
            return p
    return CHANGE_CHANGED


def _needs_review(flags: list[str], base: BomLine | None, target: BomLine | None) -> bool:
    if CHANGE_ADDED in flags or CHANGE_REMOVED in flags:
        return True
    if CHANGE_MPN in flags or CHANGE_MFR in flags:
        return True
    ln = target or base
    if ln and ln.needs_review:
        return True
    return False


def compare_bom_versions(
    db: Session,
    *,
    project_id: int,
    base_version_id: int,
    target_version_id: int,
) -> BomCompareResponse:
    project = db.get(Project, project_id)
    if project is None:
        raise ValueError("Project not found")

    base_version = db.get(BomVersion, base_version_id)
    target_version = db.get(BomVersion, target_version_id)
    if base_version is None or base_version.project_id != project_id:
        raise ValueError("Base BOM version not found for project")
    if target_version is None or target_version.project_id != project_id:
        raise ValueError("Target BOM version not found for project")

    base_lines = list(
        db.scalars(
            select(BomLine)
            .where(BomLine.bom_version_id == base_version_id)
            .order_by(BomLine.line_no, BomLine.id)
        )
    )
    target_lines = list(
        db.scalars(
            select(BomLine)
            .where(BomLine.bom_version_id == target_version_id)
            .order_by(BomLine.line_no, BomLine.id)
        )
    )

    pairs, _, _ = _pair_lines(base_lines, target_lines)
    summary = BomCompareSummary()
    changes: list[BomCompareChangeRow] = []

    for base, target in pairs:
        flags = _change_flags(base, target)
        primary = _primary_change_type(flags)
        review = _needs_review(flags, base, target)

        if CHANGE_ADDED in flags:
            summary.added += 1
        if CHANGE_REMOVED in flags:
            summary.removed += 1
        if CHANGE_UNCHANGED in flags and len(flags) == 1:
            summary.unchanged += 1
        elif CHANGE_ADDED not in flags and CHANGE_REMOVED not in flags:
            summary.changed += 1
        if CHANGE_QTY in flags:
            summary.qty_changed += 1
        if CHANGE_MPN in flags:
            summary.mpn_changed += 1
        if CHANGE_MFR in flags:
            summary.manufacturer_changed += 1
        if CHANGE_DESC in flags:
            summary.description_changed += 1
        if CHANGE_DNP in flags:
            summary.dnp_changed += 1
        if review:
            summary.needs_review += 1

        notes_parts: list[str] = []
        if base and base.review_reason:
            notes_parts.append(base.review_reason)
        if target and target.review_reason and target.review_reason not in notes_parts:
            notes_parts.append(target.review_reason)

        changes.append(
            BomCompareChangeRow(
                change_type=primary,
                change_flags=[f for f in flags if f != CHANGE_UNCHANGED or len(flags) == 1],
                base_line_id=base.id if base else None,
                target_line_id=target.id if target else None,
                designator=_display_designator(base, target),
                old_mpn=base.mpn if base else None,
                new_mpn=target.mpn if target else None,
                old_manufacturer=base.manufacturer if base else None,
                new_manufacturer=target.manufacturer if target else None,
                old_qty=_qty_value(base),
                new_qty=_qty_value(target),
                old_dnp=base.dnp if base else None,
                new_dnp=target.dnp if target else None,
                old_description=base.description if base else None,
                new_description=target.description if target else None,
                notes="; ".join(notes_parts) if notes_parts else None,
                needs_review=review,
            )
        )

    return BomCompareResponse(
        project_id=project_id,
        base_version=BomVersionRead.model_validate(base_version),
        target_version=BomVersionRead.model_validate(target_version),
        summary=summary,
        changes=changes,
    )


def _snapshot_counts(db: Session, version_ids: list[int]) -> dict[int, int]:
    if not version_ids:
        return {}
    rows = db.execute(
        select(OfficialPriceSnapshot.bom_version_id, func.count())
        .where(OfficialPriceSnapshot.bom_version_id.in_(version_ids))
        .group_by(OfficialPriceSnapshot.bom_version_id)
    ).all()
    return {int(vid): int(cnt) for vid, cnt in rows}


def build_version_catalog(db: Session, project_id: int) -> BomVersionCatalogResponse:
    project = db.get(Project, project_id)
    if project is None:
        raise ValueError("Project not found")

    customer_name: str | None = None
    if project.customer_id:
        customer = db.get(Customer, project.customer_id)
        customer_name = customer.name if customer else None

    versions = list(
        db.scalars(
            select(BomVersion)
            .where(BomVersion.project_id == project_id)
            .order_by(BomVersion.id.desc())
        )
    )
    version_ids = [v.id for v in versions]
    snap_counts = _snapshot_counts(db, version_ids)

    items: list[BomVersionCatalogItem] = []
    last_uploaded = None

    for version in versions:
        lines = list(
            db.scalars(select(BomLine).where(BomLine.bom_version_id == version.id))
        )
        summary = compute_quality_summary(lines)
        dnp_count = summary.get("dnp_count", 0)
        total = len(lines)
        uploaded = version.imported_at or version.created_at
        if uploaded is not None:
            uploaded_iso = uploaded.isoformat()
            if last_uploaded is None or uploaded_iso > last_uploaded:
                last_uploaded = uploaded_iso

        items.append(
            BomVersionCatalogItem(
                **BomVersionRead.model_validate(version).model_dump(),
                total_lines=total,
                dnp_count=dnp_count,
                non_dnp_count=max(0, total - dnp_count),
                quality_score=summary.get("quality_score"),
                needs_review_count=summary.get("needs_review_count", 0),
                pricing_snapshot_count=snap_counts.get(version.id, 0),
                is_project_active=project.active_version_id == version.id,
            )
        )

    return BomVersionCatalogResponse(
        project_id=project_id,
        project_name=project.name,
        customer_name=customer_name,
        active_version_id=project.active_version_id,
        total_versions=len(items),
        last_uploaded_at=last_uploaded,
        versions=items,
    )


def activate_bom_version(db: Session, version_id: int) -> BomVersion:
    version = db.get(BomVersion, version_id)
    if version is None:
        raise ValueError("BOM version not found")
    project = db.get(Project, version.project_id)
    if project is None:
        raise ValueError("Project not found")

    for other in db.scalars(
        select(BomVersion).where(
            BomVersion.project_id == project.id, BomVersion.id != version.id
        )
    ):
        other.is_active = False

    version.is_active = True
    project.active_version_id = version.id
    db.flush()
    return version
