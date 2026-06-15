from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import ORMModel


class BomVersionBase(BaseModel):
    project_id: int
    version_label: str
    status: str = "Draft"
    source: str | None = None
    notes: str | None = None
    is_active: bool = False
    created_by_id: int | None = None


class BomVersionCreate(BomVersionBase):
    pass


class BomVersionUpdate(BaseModel):
    version_label: str | None = None
    status: str | None = None
    source: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class BomVersionRead(BomVersionBase, ORMModel):
    id: int
    created_at: datetime
