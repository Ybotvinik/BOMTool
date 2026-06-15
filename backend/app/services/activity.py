"""Activity log helper.

Every significant action in the system should be recorded here so the
``activity_log`` table acts as a complete audit trail (no RBAC in MVP, but full
traceability of who did what).
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import ActivityLog


def log_activity(
    db: Session,
    *,
    user_id: int | None,
    action_type: str,
    project_id: int | None = None,
    entity_type: str | None = None,
    entity_name: str | None = None,
    change_summary: str | None = None,
    commit: bool = True,
) -> ActivityLog:
    """Create an activity_log entry.

    Args mirror the spec: ``log_activity(user_id, action_type, project_id,
    entity_type, entity_name, change_summary)``.
    """
    entry = ActivityLog(
        user_id=user_id,
        action_type=action_type,
        project_id=project_id,
        entity_type=entity_type,
        entity_name=entity_name,
        change_summary=change_summary,
    )
    db.add(entry)
    if commit:
        db.commit()
        db.refresh(entry)
    else:
        db.flush()
    return entry
