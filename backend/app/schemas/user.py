from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.schemas.common import ORMModel


class UserBase(BaseModel):
    name: str
    email: EmailStr | None = None
    initials: str | None = None
    is_active: bool = True


class UserCreate(UserBase):
    pass


class UserUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    initials: str | None = None
    is_active: bool | None = None


class UserRead(UserBase, ORMModel):
    id: int
    created_at: datetime
