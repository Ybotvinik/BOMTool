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
    version_name: str | None = None
    revision_code: str | None = None
    source_file_name: str | None = None
    source_doc_number: str | None = None
    board_name: str | None = None
    revised_date: str | None = None
    bom_type: str | None = None
    build_quantity: int | None = None
    imported_at: datetime | None = None
    imported_by_user_id: int | None = None
