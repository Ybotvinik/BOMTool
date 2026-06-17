"""BOM line override persistence and effective-value helpers."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import BomLine, BomLineOverride, BomVersion
from app.services.bom_quality import (
    clean_mpn,
    compute_quality_summary,
    compute_required_qty,
    reanalyze_bom_version_quality,
)

REVIEW_OPEN = "open"
REVIEW_REVIEWED = "reviewed"
REVIEW_CORRECTED = "corrected"
REVIEW_OK = "ok"


def overrides_for_version(db: Session, bom_version_id: int) -> dict[int, BomLineOverride]:
    rows = db.scalars(
        select(BomLineOverride)
        .join(BomLine, BomLine.id == BomLineOverride.bom_line_id)
        .where(BomLine.bom_version_id == bom_version_id)
    )
    return {row.bom_line_id: row for row in rows}


def get_override(db: Session, bom_line_id: int) -> BomLineOverride | None:
    return db.scalar(
        select(BomLineOverride).where(BomLineOverride.bom_line_id == bom_line_id)
    )


def _snapshot_originals(override: BomLineOverride, line: BomLine) -> None:
    if override.original_mpn is not None:
        return
    override.original_mpn = line.mpn
    override.original_manufacturer = line.manufacturer
    override.original_description = line.description
    override.original_quantity = float(line.quantity) if line.quantity is not None else None
    override.original_dnp = line.dnp


def original_values(line: BomLine, override: BomLineOverride | None) -> dict:
    if override and override.original_mpn is not None:
        return {
            "mpn": override.original_mpn,
            "manufacturer": override.original_manufacturer,
            "description": override.original_description,
            "quantity": override.original_quantity,
            "dnp": override.original_dnp if override.original_dnp is not None else line.dnp,
        }
    return {
        "mpn": line.mpn,
        "manufacturer": line.manufacturer,
        "description": line.description,
        "quantity": float(line.quantity) if line.quantity is not None else None,
        "dnp": line.dnp,
    }


def effective_values(line: BomLine, override: BomLineOverride | None) -> dict:
    orig = original_values(line, override)
    if not override:
        return {**orig, "cleaned_mpn": line.cleaned_mpn or clean_mpn(line.mpn)}
    mpn = override.mpn if override.mpn is not None else orig["mpn"]
    manufacturer = (
        override.manufacturer if override.manufacturer is not None else orig["manufacturer"]
    )
    description = (
        override.description if override.description is not None else orig["description"]
    )
    quantity = override.quantity if override.quantity is not None else orig["quantity"]
    dnp = override.dnp if override.dnp is not None else orig["dnp"]
    cleaned = clean_mpn(mpn)
    return {
        "mpn": mpn,
        "manufacturer": manufacturer,
        "description": description,
        "quantity": quantity,
        "dnp": dnp,
        "cleaned_mpn": cleaned,
    }


def has_correction(override: BomLineOverride | None) -> bool:
    if override is None:
        return False
    return any(
        getattr(override, f) is not None
        for f in ("mpn", "manufacturer", "description", "quantity", "dnp")
    )


def review_status(line: BomLine, override: BomLineOverride | None) -> str:
    if has_correction(override):
        return REVIEW_CORRECTED
    if override and override.quality_reviewed:
        return REVIEW_REVIEWED
    if line.needs_review:
        return REVIEW_OPEN
    return REVIEW_OK


def line_to_quality_dict(line: BomLine, override: BomLineOverride | None = None) -> dict:
    eff = effective_values(line, override)
    orig = original_values(line, override)
    qty = eff["quantity"]
    req = line.required_qty
    if req is not None:
        req_f = float(req)
    elif qty is not None:
        req_f = float(compute_required_qty(Decimal(str(qty)), None, eff["dnp"]))
    else:
        req_f = None
    notes_parts = [p for p in [override.correction_note if override else None, line.notes] if p]
    return {
        "line_id": line.id,
        "line_number": line.line_no,
        "original_mpn": eff["mpn"],
        "uploaded_mpn": orig["mpn"],
        "cleaned_mpn": eff["cleaned_mpn"],
        "manufacturer": eff["manufacturer"],
        "uploaded_manufacturer": orig["manufacturer"],
        "original_description": eff["description"],
        "uploaded_description": orig["description"],
        "qty_per_assembly": float(qty) if qty is not None else None,
        "uploaded_qty": float(orig["quantity"]) if orig["quantity"] is not None else None,
        "required_qty": req_f,
        "reference_designators": line.reference_designators,
        "footprint": line.footprint,
        "value_text": line.value,
        "is_dnp": eff["dnp"],
        "uploaded_dnp": orig["dnp"],
        "quality_status": line.quality_status,
        "needs_review": line.needs_review,
        "review_reason": line.review_reason,
        "review_status": review_status(line, override),
        "quality_reviewed": bool(override and override.quality_reviewed),
        "quality_review_note": override.quality_review_note if override else None,
        "correction_note": override.correction_note if override else None,
        "has_correction": has_correction(override),
        "notes": " — ".join(notes_parts) if notes_parts else line.notes,
    }


def _get_or_create_override(db: Session, line: BomLine, user_id: int | None) -> BomLineOverride:
    row = get_override(db, line.id)
    if row:
        return row
    row = BomLineOverride(bom_line_id=line.id, created_by_user_id=user_id, updated_by_user_id=user_id)
    db.add(row)
    db.flush()
    return row


def save_line_override(
    db: Session,
    *,
    line: BomLine,
    mpn: str | None = None,
    manufacturer: str | None = None,
    description: str | None = None,
    quantity: float | None = None,
    dnp: bool | None = None,
    correction_note: str | None = None,
    user_id: int | None,
) -> tuple[BomLine, BomLineOverride | None, dict]:
    override = _get_or_create_override(db, line, user_id)
    _snapshot_originals(override, line)

    if mpn is not None:
        override.mpn = mpn.strip() or None
    if manufacturer is not None:
        override.manufacturer = manufacturer.strip() or None
    if description is not None:
        override.description = description.strip() or None
    if quantity is not None:
        override.quantity = quantity
    if dnp is not None:
        override.dnp = dnp
    if correction_note is not None:
        override.correction_note = correction_note.strip() or None

    override.quality_reviewed = False
    override.quality_review_note = None
    override.quality_reviewed_at = None
    override.quality_reviewed_by_user_id = None
    override.updated_by_user_id = user_id

    db.flush()
    analyzed = reanalyze_bom_version_quality(db, line.bom_version_id)
    summary = compute_quality_summary(analyzed)
    db.refresh(line)
    ov = get_override(db, line.id)
    return line, ov, summary


def save_quality_review(
    db: Session,
    *,
    line: BomLine,
    note: str | None,
    user_id: int | None,
) -> tuple[BomLine, BomLineOverride, dict]:
    if line.quality_status == "error":
        raise ValueError("לא ניתן לסמן כנבדק כל עוד קיימת שגיאה קריטית בשורה")

    override = _get_or_create_override(db, line, user_id)
    _snapshot_originals(override, line)
    override.quality_reviewed = True
    override.quality_review_note = note.strip() if note else None
    override.quality_reviewed_at = datetime.now(timezone.utc)
    override.quality_reviewed_by_user_id = user_id
    override.updated_by_user_id = user_id

    line.needs_review = False
    line.reviewed_at = override.quality_reviewed_at
    line.reviewed_by_user_id = user_id

    db.flush()
    analyzed = reanalyze_bom_version_quality(db, line.bom_version_id)
    summary = compute_quality_summary(analyzed)
    db.refresh(line)
    db.refresh(override)
    return line, override, summary


def quality_lines_for_version(db: Session, bom_version_id: int) -> list[dict]:
    lines = list(
        db.scalars(
            select(BomLine)
            .where(BomLine.bom_version_id == bom_version_id)
            .order_by(BomLine.line_no, BomLine.id)
        )
    )
    overrides = overrides_for_version(db, bom_version_id)
    return [line_to_quality_dict(ln, overrides.get(ln.id)) for ln in lines]


def open_quality_issues(db: Session, bom_version_id: int) -> list[dict]:
    lines = list(
        db.scalars(
            select(BomLine)
            .where(BomLine.bom_version_id == bom_version_id)
            .order_by(BomLine.line_no, BomLine.id)
        )
    )
    overrides = overrides_for_version(db, bom_version_id)
    out: list[dict] = []
    for ln in lines:
        ov = overrides.get(ln.id)
        if not ln.needs_review and ln.quality_status == "ok":
            continue
        if ov and ov.quality_reviewed and not has_correction(ov):
            continue
        out.append(line_to_quality_dict(ln, ov))
    return out
