from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import ORMModel


class CustomerBase(BaseModel):
    name: str
    contact_name: str | None = None
    contact_email: str | None = None
    notes: str | None = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: str | None = None
    contact_name: str | None = None
    contact_email: str | None = None
    notes: str | None = None


class CustomerRead(CustomerBase, ORMModel):
    id: int
    created_at: datetime
