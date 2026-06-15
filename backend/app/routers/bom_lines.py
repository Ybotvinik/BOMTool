from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user_id
from app.models import BomLine, BomVersion
from app.schemas.bom_line import BomLineCreate, BomLineEdit, BomLineRead
from app.services.activity import log_activity
from app.services.bom_quality import (
    clean_mpn,
    compute_quality_summary,
    compute_required_qty,
    line_to_quality_dict,
    reanalyze_bom_version_quality,
)

router = APIRouter(prefix="/bom-lines", tags=["bom_lines"])


def _project_id_for_version(db: Session, bom_version_id: int) -> int | None:
    version = db.get(BomVersion, bom_version_id)
    return version.project_id if version else None


@router.get("", response_model=list[BomLineRead])
def list_bom_lines(
    bom_version_id: int | None = None, db: Session = Depends(get_db)
) -> list[BomLine]:
    stmt = select(BomLine).order_by(BomLine.line_no, BomLine.id)
    if bom_version_id is not None:
        stmt = stmt.where(BomLine.bom_version_id == bom_version_id)
    return list(db.scalars(stmt))


@router.post("", response_model=BomLineRead, status_code=status.HTTP_201_CREATED)
def create_bom_line(
    payload: BomLineCreate,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> BomLine:
    line = BomLine(**payload.model_dump())
    db.add(line)
    db.commit()
    db.refresh(line)
    log_activity(
        db,
        user_id=user_id,
        action_type="bom_line.create",
        project_id=_project_id_for_version(db, line.bom_version_id),
        entity_type="bom_line",
        entity_name=line.mpn,
        change_summary=f"Added BOM line '{line.mpn}'",
    )
    return line


@router.get("/{line_id}", response_model=BomLineRead)
def get_bom_line(line_id: int, db: Session = Depends(get_db)) -> BomLine:
    line = db.get(BomLine, line_id)
    if line is None:
        raise HTTPException(status_code=404, detail="BOM line not found")
    return line


@router.patch("/{line_id}")
def update_bom_line(
    line_id: int,
    payload: BomLineEdit,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> dict:
    line = db.get(BomLine, line_id)
    if line is None:
        raise HTTPException(status_code=404, detail="BOM line not found")

    data = payload.model_dump(exclude_unset=True)
    changed: list[str] = []

    # Map quality-API field names onto the model.
    field_map = {
        "original_mpn": "mpn",
        "manufacturer": "manufacturer",
        "original_description": "description",
        "reference_designators": "reference_designators",
        "footprint": "footprint",
        "value_text": "value",
        "is_dnp": "dnp",
        "notes": "notes",
    }
    for api_field, model_field in field_map.items():
        if api_field in data:
            new_val = data[api_field]
            if getattr(line, model_field) != new_val:
                changed.append(api_field)
            setattr(line, model_field, new_val)

    if "qty_per_assembly" in data:
        if line.quantity != data["qty_per_assembly"]:
            changed.append("qty_per_assembly")
        line.quantity = data["qty_per_assembly"]

    # Recalculate cleaned_mpn (unless explicitly provided).
    if "cleaned_mpn" in data and data["cleaned_mpn"] is not None:
        line.cleaned_mpn = clean_mpn(data["cleaned_mpn"])
    elif "original_mpn" in data:
        line.cleaned_mpn = clean_mpn(line.mpn)

    version = db.get(BomVersion, line.bom_version_id)
    build_qty = version.build_quantity if version else None
    line.required_qty = compute_required_qty(line.quantity, build_qty, line.dnp)

    db.flush()
    # Re-run quality for the full version (duplicate context may change).
    analyzed = reanalyze_bom_version_quality(db, line.bom_version_id)
    summary = compute_quality_summary(analyzed)

    log_activity(
        db,
        user_id=user_id,
        action_type="bom_line_updated",
        project_id=version.project_id if version else None,
        entity_type="bom_line",
        entity_name=line.mpn,
        change_summary=(
            f"Updated BOM line #{line.line_no} ({line.mpn or '—'}); "
            f"changed: {', '.join(changed) if changed else 'none'}"
        ),
        commit=False,
    )
    db.commit()
    db.refresh(line)
    return {
        "line": line_to_quality_dict(line),
        "quality_summary": {"bom_version_id": line.bom_version_id, **summary},
    }


@router.post("/{line_id}/mark-reviewed")
def mark_reviewed(
    line_id: int,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> dict:
    line = db.get(BomLine, line_id)
    if line is None:
        raise HTTPException(status_code=404, detail="BOM line not found")
    if line.quality_status == "error":
        raise HTTPException(
            status_code=409,
            detail="לא ניתן לסמן כנבדק כל עוד קיימת שגיאה קריטית בשורה",
        )
    line.needs_review = False
    line.reviewed_at = datetime.now(timezone.utc)
    line.reviewed_by_user_id = user_id
    version = db.get(BomVersion, line.bom_version_id)
    log_activity(
        db,
        user_id=user_id,
        action_type="bom_line_reviewed",
        project_id=version.project_id if version else None,
        entity_type="bom_line",
        entity_name=line.mpn,
        change_summary=f"Marked BOM line #{line.line_no} ({line.mpn or '—'}) as reviewed",
        commit=False,
    )
    db.commit()
    db.refresh(line)
    return {"line": line_to_quality_dict(line)}


@router.delete("/{line_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bom_line(
    line_id: int,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> None:
    line = db.get(BomLine, line_id)
    if line is None:
        raise HTTPException(status_code=404, detail="BOM line not found")
    mpn, version_id = line.mpn, line.bom_version_id
    db.delete(line)
    db.commit()
    log_activity(
        db,
        user_id=user_id,
        action_type="bom_line.delete",
        project_id=_project_id_for_version(db, version_id),
        entity_type="bom_line",
        entity_name=mpn,
        change_summary=f"Deleted BOM line '{mpn}'",
    )
