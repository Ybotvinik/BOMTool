from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user_id
from app.models import BomVersion
from app.schemas.bom_version import (
    BomVersionCreate,
    BomVersionRead,
    BomVersionUpdate,
)
from app.services.activity import log_activity

router = APIRouter(prefix="/bom-versions", tags=["bom_versions"])


@router.get("", response_model=list[BomVersionRead])
def list_bom_versions(
    project_id: int | None = None, db: Session = Depends(get_db)
) -> list[BomVersion]:
    stmt = select(BomVersion).order_by(BomVersion.id)
    if project_id is not None:
        stmt = stmt.where(BomVersion.project_id == project_id)
    return list(db.scalars(stmt))


@router.post("", response_model=BomVersionRead, status_code=status.HTTP_201_CREATED)
def create_bom_version(
    payload: BomVersionCreate,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> BomVersion:
    version = BomVersion(**payload.model_dump())
    db.add(version)
    db.commit()
    db.refresh(version)
    log_activity(
        db,
        user_id=user_id,
        action_type="bom_version.create",
        project_id=version.project_id,
        entity_type="bom_version",
        entity_name=version.version_label,
        change_summary=f"Created BOM version '{version.version_label}'",
    )
    return version


@router.get("/{version_id}", response_model=BomVersionRead)
def get_bom_version(version_id: int, db: Session = Depends(get_db)) -> BomVersion:
    version = db.get(BomVersion, version_id)
    if version is None:
        raise HTTPException(status_code=404, detail="BOM version not found")
    return version


@router.patch("/{version_id}", response_model=BomVersionRead)
def update_bom_version(
    version_id: int,
    payload: BomVersionUpdate,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> BomVersion:
    version = db.get(BomVersion, version_id)
    if version is None:
        raise HTTPException(status_code=404, detail="BOM version not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(version, field, value)
    db.commit()
    db.refresh(version)
    log_activity(
        db,
        user_id=user_id,
        action_type="bom_version.update",
        project_id=version.project_id,
        entity_type="bom_version",
        entity_name=version.version_label,
        change_summary=f"Updated BOM version '{version.version_label}'",
    )
    return version


@router.delete("/{version_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bom_version(
    version_id: int,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> None:
    version = db.get(BomVersion, version_id)
    if version is None:
        raise HTTPException(status_code=404, detail="BOM version not found")
    label, project_id = version.version_label, version.project_id
    db.delete(version)
    db.commit()
    log_activity(
        db,
        user_id=user_id,
        action_type="bom_version.delete",
        project_id=project_id,
        entity_type="bom_version",
        entity_name=label,
        change_summary=f"Deleted BOM version '{label}'",
    )
