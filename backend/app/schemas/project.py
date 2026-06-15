from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import ORMModel


class NewCustomer(BaseModel):
    name: str
    code: str | None = None


class ProjectBase(BaseModel):
    customer_id: int
    name: str
    code: str
    build_quantity: int = 1
    status: str = "Active"
    description: str | None = None
    active_version_id: int | None = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    customer_id: int | None = None
    # When creating a customer inline; takes precedence over customer_id.
    new_customer: NewCustomer | None = None
    name: str | None = None
    code: str | None = None
    build_quantity: int | None = None
    status: str | None = None
    description: str | None = None
    active_version_id: int | None = None


class ProjectRead(ProjectBase, ORMModel):
    id: int
    created_at: datetime
    updated_at: datetime
