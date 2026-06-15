from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.common import ORMModel


class BomLineBase(BaseModel):
    bom_version_id: int
    line_no: int | None = None
    mpn: str | None = None
    manufacturer: str | None = None
    description: str | None = None
    quantity: Decimal = Decimal(0)
    reference_designators: str | None = None
    footprint: str | None = None
    value: str | None = None
    supplier_part_number: str | None = None
    unit: str | None = None
    customer_price: Decimal | None = None
    internal_cost: Decimal | None = None
    is_critical: bool = False
    dnp: bool = False
    notes: str | None = None


class BomLineCreate(BomLineBase):
    pass


class BomLineUpdate(BaseModel):
    line_no: int | None = None
    mpn: str | None = None
    manufacturer: str | None = None
    description: str | None = None
    quantity: Decimal | None = None
    reference_designators: str | None = None
    footprint: str | None = None
    value: str | None = None
    supplier_part_number: str | None = None
    unit: str | None = None
    customer_price: Decimal | None = None
    internal_cost: Decimal | None = None
    is_critical: bool | None = None
    dnp: bool | None = None
    notes: str | None = None


class BomLineRead(BomLineBase, ORMModel):
    id: int
    created_at: datetime
