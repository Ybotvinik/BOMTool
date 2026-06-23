from pydantic import BaseModel

from app.schemas.bom_version import BomVersionRead


class BomVersionCatalogItem(BomVersionRead):
    total_lines: int = 0
    dnp_count: int = 0
    non_dnp_count: int = 0
    quality_score: float | None = None
    needs_review_count: int = 0
    pricing_snapshot_count: int = 0
    is_project_active: bool = False


class BomVersionCatalogResponse(BaseModel):
    project_id: int
    project_name: str
    customer_name: str | None = None
    active_version_id: int | None = None
    total_versions: int = 0
    last_uploaded_at: str | None = None
    versions: list[BomVersionCatalogItem]


class BomCompareSummary(BaseModel):
    added: int = 0
    removed: int = 0
    changed: int = 0
    unchanged: int = 0
    qty_changed: int = 0
    mpn_changed: int = 0
    manufacturer_changed: int = 0
    description_changed: int = 0
    dnp_changed: int = 0
    needs_review: int = 0


class BomCompareChangeRow(BaseModel):
    change_type: str
    change_flags: list[str]
    base_line_id: int | None = None
    target_line_id: int | None = None
    designator: str | None = None
    old_mpn: str | None = None
    new_mpn: str | None = None
    old_manufacturer: str | None = None
    new_manufacturer: str | None = None
    old_qty: float | None = None
    new_qty: float | None = None
    old_dnp: bool | None = None
    new_dnp: bool | None = None
    old_description: str | None = None
    new_description: str | None = None
    notes: str | None = None
    needs_review: bool = False


class BomCompareResponse(BaseModel):
    project_id: int
    base_version: BomVersionRead
    target_version: BomVersionRead
    summary: BomCompareSummary
    changes: list[BomCompareChangeRow]
