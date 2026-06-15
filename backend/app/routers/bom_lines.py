from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user_id
from app.models import BomLine, BomVersion
from app.schemas.bom_line import BomLineCreate, BomLineRead, BomLineUpdate
from app.services.activity import log_activity

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


@router.patch("/{line_id}", response_model=BomLineRead)
def update_bom_line(
    line_id: int,
    payload: BomLineUpdate,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> BomLine:
    line = db.get(BomLine, line_id)
    if line is None:
        raise HTTPException(status_code=404, detail="BOM line not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(line, field, value)
    db.commit()
    db.refresh(line)
    log_activity(
        db,
        user_id=user_id,
        action_type="bom_line.update",
        project_id=_project_id_for_version(db, line.bom_version_id),
        entity_type="bom_line",
        entity_name=line.mpn,
        change_summary=f"Updated BOM line '{line.mpn}'",
    )
    return line


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
