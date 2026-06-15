from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import ORMModel


class ActivityLogBase(BaseModel):
    user_id: int | None = None
    action_type: str
    project_id: int | None = None
    entity_type: str | None = None
    entity_name: str | None = None
    change_summary: str | None = None


class ActivityLogCreate(ActivityLogBase):
    pass


class ActivityLogRead(ActivityLogBase, ORMModel):
    id: int
    created_at: datetime
