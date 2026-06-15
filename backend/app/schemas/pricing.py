from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import ORMModel


class PricingFromChinaQuote(BaseModel):
    project_id: int
    bom_version_id: int
    supplier_quote_id: int
    snapshot_name: str | None = None


class PricingSnapshotResult(BaseModel):
    pricing_snapshot_id: int
    priced_count: int
    missing_price_count: int
    needs_review_count: int
    total_internal_cost: float
    currency: str


class PricingSnapshotRead(ORMModel):
    id: int
    project_id: int
    bom_version_id: int | None
    snapshot_name: str | None
    name: str
    source_type: str
    supplier_quote_id: int | None
    currency: str
    status: str
    created_at: datetime
