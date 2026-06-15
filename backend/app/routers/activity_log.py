from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ActivityLog
from app.schemas.activity_log import ActivityLogCreate, ActivityLogRead

router = APIRouter(prefix="/activity-log", tags=["activity_log"])


@router.get("", response_model=list[ActivityLogRead])
def list_activity(
    project_id: int | None = None,
    limit: int = 200,
    db: Session = Depends(get_db),
) -> list[ActivityLog]:
    stmt = select(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(limit)
    if project_id is not None:
        stmt = stmt.where(ActivityLog.project_id == project_id)
    return list(db.scalars(stmt))


@router.post("", response_model=ActivityLogRead, status_code=status.HTTP_201_CREATED)
def create_activity(
    payload: ActivityLogCreate, db: Session = Depends(get_db)
) -> ActivityLog:
    entry = ActivityLog(**payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
