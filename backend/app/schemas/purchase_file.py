from datetime import datetime

from pydantic import BaseModel, Field


class PurchaseFileProject(BaseModel):
    id: int
    name: str
    code: str
    customer_name: str | None = None


class PurchaseFileBomVersion(BaseModel):
    id: int
    version_label: str
    version_name: str | None = None
    build_quantity: int | None = None
    is_active: bool = False
    is_project_active: bool = False


class PurchaseFileSnapshotOption(BaseModel):
    id: int
    snapshot_name: str
    created_at: datetime


class PurchaseFileSummary(BaseModel):
    grand_total: float = 0.0
    ready_lines: int = 0
    needs_approval: int = 0
    no_stock: int = 0
    no_solution: int = 0
    needs_handling: int = 0
    dnp_excluded: int = 0
    purchase_lines: int = 0


class PurchaseSupplierSummary(BaseModel):
    supplier: str
    supplier_key: str
    source_type: str | None = None
    internal_only: bool = False
    lines_count: int = 0
    total: float = 0.0
    needs_approval: int = 0
    no_stock: int = 0
    no_solution: int = 0
    lead_time_summary: str | None = None


class PurchaseFileLine(BaseModel):
    bom_line_id: int
    line_number: int | None = None
    supplier: str | None = None
    source: str | None = None
    source_type: str | None = None
    internal_only: bool = False
    mpn: str | None = None
    manufacturer: str | None = None
    description: str | None = None
    designators: str | None = None
    required_qty: float | None = None
    supplier_part_number: str | None = None
    unit_price: float | None = None
    extended_price: float | None = None
    currency: str = "USD"
    stock: float | None = None
    lead_time: str | None = None
    status: str | None = None
    solution_status: str | None = None
    notes: str | None = None
    match_reason: str | None = None
    needs_handling: bool = False
    offers: list[dict] = Field(default_factory=list)


class PurchaseFileResponse(BaseModel):
    project: PurchaseFileProject
    bom_version: PurchaseFileBomVersion
    pricing_mode: str
    include_east: bool
    supplier_filter: str
    snapshot_id: int | None = None
    snapshot_name: str | None = None
    generated_at: datetime
    summary: PurchaseFileSummary
    supplier_summaries: list[PurchaseSupplierSummary]
    lines: list[PurchaseFileLine]
    needs_handling_lines: list[PurchaseFileLine]
    available_snapshots: list[PurchaseFileSnapshotOption]
