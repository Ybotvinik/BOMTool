from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user_id
from app.models import BomLine, BomVersion
from app.schemas.bom_line import BomLineRead
from app.schemas.bom_version import (
    BomVersionCreate,
    BomVersionRead,
    BomVersionUpdate,
)
from app.services.activity import log_activity
from app.services.bom_quality import reanalyze_bom_version_quality
from app.services.bom_line_override import (
    line_to_quality_dict,
    open_quality_issues,
    quality_lines_for_version,
)
from app.services.bom_quality import (
    compute_quality_summary,
    reanalyze_bom_version_quality,
)

router = APIRouter(prefix="/bom-versions", tags=["bom_versions"])


@router.get("", response_model=list[BomVersionRead])
def list_bom_versions(
    project_id: int | None = None, db: Session = Depends(get_db)
) -> list[BomVersion]:
    stmt = select(BomVersion).order_by(BomVersion.id)
    if project_id is not None:
        stmt = stmt.where(BomVersion.project_id == project_id)
    return list(db.scalars(stmt))


@router.get("/{version_id}/lines", response_model=list[BomLineRead])
def list_version_lines(version_id: int, db: Session = Depends(get_db)) -> list[BomLine]:
    """Return all BOM lines for a given version (used by the BOM table page)."""
    if db.get(BomVersion, version_id) is None:
        raise HTTPException(status_code=404, detail="BOM version not found")
    stmt = (
        select(BomLine)
        .where(BomLine.bom_version_id == version_id)
        .order_by(BomLine.line_no, BomLine.id)
    )
    return list(db.scalars(stmt))


def _version_lines(db: Session, version_id: int) -> list[BomLine]:
    return list(
        db.scalars(
            select(BomLine)
            .where(BomLine.bom_version_id == version_id)
            .order_by(BomLine.line_no, BomLine.id)
        )
    )


@router.get("/{version_id}/quality-lines")
def quality_lines(version_id: int, db: Session = Depends(get_db)) -> list[dict]:
    version = db.get(BomVersion, version_id)
    if version is None:
        raise HTTPException(status_code=404, detail="BOM version not found")
    return quality_lines_for_version(db, version_id)


@router.get("/{version_id}/quality-summary")
def quality_summary(version_id: int, db: Session = Depends(get_db)) -> dict:
    version = db.get(BomVersion, version_id)
    if version is None:
        raise HTTPException(status_code=404, detail="BOM version not found")
    summary = compute_quality_summary(_version_lines(db, version_id))
    return {"bom_version_id": version_id, **summary}


@router.post("/{version_id}/reanalyze-quality")
def reanalyze_quality(
    version_id: int,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> dict:
    version = db.get(BomVersion, version_id)
    if version is None:
        raise HTTPException(status_code=404, detail="BOM version not found")
    lines = reanalyze_bom_version_quality(db, version_id)
    summary = compute_quality_summary(lines)
    log_activity(
        db,
        user_id=user_id,
        action_type="bom_quality_reanalyzed",
        project_id=version.project_id,
        entity_type="bom_version",
        entity_name=version.version_label,
        change_summary=(
            f"Re-analyzed quality for '{version.version_label}': "
            f"score {summary['quality_score']}, {summary['error_count']} errors, "
            f"{summary['warning_count']} warnings"
        ),
    )
    return {"bom_version_id": version_id, **summary}


@router.get("/{version_id}/quality-issues")
def quality_issues(version_id: int, db: Session = Depends(get_db)) -> list[dict]:
    version = db.get(BomVersion, version_id)
    if version is None:
        raise HTTPException(status_code=404, detail="BOM version not found")
    return open_quality_issues(db, version_id)


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
    data = payload.model_dump(exclude_unset=True)
    if "build_quantity" in data:
        bq = data["build_quantity"]
        if bq is not None and bq <= 0:
            raise HTTPException(
                status_code=400, detail="כמות להרכבה חייבת להיות מספר חיובי"
            )
    for field, value in data.items():
        setattr(version, field, value)
    if "build_quantity" in data:
        reanalyze_bom_version_quality(db, version_id)
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
