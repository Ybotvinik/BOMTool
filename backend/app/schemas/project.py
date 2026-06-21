from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class NewCustomer(BaseModel):
    name: str
    code: str | None = None


class ProjectBase(BaseModel):
    customer_id: int
    name: str
    code: str
    build_quantity: int = 1
    status: str = "NEW"
    description: str | None = None
    active_version_id: int | None = None
    drive_folder_url: str | None = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    customer_id: int | None = None
    # When creating a customer inline; takes precedence over customer_id.
    new_customer: NewCustomer | None = None
    name: str | None = None
    code: str | None = None
    build_quantity: int | None = Field(default=None, gt=0)  # legacy; prefer card-level qty
    status: str | None = None
    description: str | None = None
    active_version_id: int | None = None
    drive_folder_url: str | None = None


class ProjectRead(ProjectBase, ORMModel):
    id: int
    created_at: datetime
    updated_at: datetime
