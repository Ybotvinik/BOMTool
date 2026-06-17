from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user_id
from app.models import BomLine, BomVersion
from app.schemas.bom_line import (
    BomLineCreate,
    BomLineEdit,
    BomLineOverrideRequest,
    BomLineQualityReviewRequest,
    BomLineRead,
)
from app.services.activity import log_activity
from app.services.bom_line_override import (
    line_to_quality_dict,
    save_line_override,
    save_quality_review,
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


@router.patch("/{line_id}/override")
def patch_line_override(
    line_id: int,
    payload: BomLineOverrideRequest,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> dict:
    line = db.get(BomLine, line_id)
    if line is None:
        raise HTTPException(status_code=404, detail="BOM line not found")

    data = payload.model_dump(exclude_unset=True)
    try:
        line, override, summary = save_line_override(
            db,
            line=line,
            mpn=data.get("mpn"),
            manufacturer=data.get("manufacturer"),
            description=data.get("description"),
            quantity=data.get("quantity"),
            dnp=data.get("dnp"),
            correction_note=data.get("correction_note"),
            user_id=user_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    version = db.get(BomVersion, line.bom_version_id)
    log_activity(
        db,
        user_id=user_id,
        action_type="bom_line_override_saved",
        project_id=version.project_id if version else None,
        entity_type="bom_line",
        entity_name=line.mpn,
        change_summary=f"Saved quality override for BOM line #{line.line_no}",
        commit=False,
    )
    db.commit()
    return {
        "line": line_to_quality_dict(line, override),
        "quality_summary": {"bom_version_id": line.bom_version_id, **summary},
    }


@router.post("/{line_id}/quality-review")
def post_quality_review(
    line_id: int,
    payload: BomLineQualityReviewRequest,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> dict:
    line = db.get(BomLine, line_id)
    if line is None:
        raise HTTPException(status_code=404, detail="BOM line not found")
    try:
        line, override, summary = save_quality_review(
            db, line=line, note=payload.note, user_id=user_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    version = db.get(BomVersion, line.bom_version_id)
    log_activity(
        db,
        user_id=user_id,
        action_type="bom_line_quality_reviewed",
        project_id=version.project_id if version else None,
        entity_type="bom_line",
        entity_name=line.mpn,
        change_summary=f"Marked BOM line #{line.line_no} as quality-reviewed",
        commit=False,
    )
    db.commit()
    return {
        "line": line_to_quality_dict(line, override),
        "quality_summary": {"bom_version_id": line.bom_version_id, **summary},
    }


@router.patch("/{line_id}")
def update_bom_line(
    line_id: int,
    payload: BomLineEdit,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> dict:
    """Legacy direct edit — delegates to override storage to preserve originals."""
    line = db.get(BomLine, line_id)
    if line is None:
        raise HTTPException(status_code=404, detail="BOM line not found")

    data = payload.model_dump(exclude_unset=True)
    override_payload: dict = {}
    if "original_mpn" in data:
        override_payload["mpn"] = data["original_mpn"]
    if "manufacturer" in data:
        override_payload["manufacturer"] = data["manufacturer"]
    if "original_description" in data:
        override_payload["description"] = data["original_description"]
    if "qty_per_assembly" in data:
        override_payload["quantity"] = (
            float(data["qty_per_assembly"]) if data["qty_per_assembly"] is not None else None
        )
    if "is_dnp" in data:
        override_payload["dnp"] = data["is_dnp"]
    if "notes" in data:
        override_payload["correction_note"] = data["notes"]

    line, override, summary = save_line_override(
        db, line=line, user_id=user_id, **override_payload
    )
    version = db.get(BomVersion, line.bom_version_id)
    log_activity(
        db,
        user_id=user_id,
        action_type="bom_line_updated",
        project_id=version.project_id if version else None,
        entity_type="bom_line",
        entity_name=line.mpn,
        change_summary=f"Updated BOM line #{line.line_no} via override",
        commit=False,
    )
    db.commit()
    return {
        "line": line_to_quality_dict(line, override),
        "quality_summary": {"bom_version_id": line.bom_version_id, **summary},
    }


@router.post("/{line_id}/mark-reviewed")
def mark_reviewed(
    line_id: int,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> dict:
    """Legacy alias for quality-review without note."""
    line = db.get(BomLine, line_id)
    if line is None:
        raise HTTPException(status_code=404, detail="BOM line not found")
    try:
        line, override, summary = save_quality_review(db, line=line, note=None, user_id=user_id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    db.commit()
    return {
        "line": line_to_quality_dict(line, override),
        "quality_summary": {"bom_version_id": line.bom_version_id, **summary},
    }


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
