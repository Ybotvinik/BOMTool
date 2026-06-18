"""Pydantic schemas for official supplier API pricing."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class SupplierConfigStatus(BaseModel):
    digikey: dict
    mouser: dict
    mock_mode: bool
    mock_allow_export: bool


class SupplierTestRequest(BaseModel):
    supplier: str
    mpn: str
    required_qty: float = 1


class SupplierTestResponse(BaseModel):
    supplier: str
    mpn: str
    matched_mpn: str | None = None
    manufacturer: str | None = None
    description: str | None = None
    supplier_part_number: str | None = None
    product_url: str | None = None
    currency: str = "USD"
    unit_price_for_required_qty: float | None = None
    price_break_qty: float | None = None
    available_qty: float | None = None
    lead_time: str | None = None
    lifecycle_status: str | None = None
    match_status: str
    match_reason: str | None = None
    is_exact_match: bool = False
    mock: bool


class OfficialPricingFetchRequest(BaseModel):
    project_id: int
    bom_version_id: int
    suppliers: list[str] = Field(default_factory=lambda: ["digikey", "mouser"])
    mode: str = "all"  # missing_only | all


class OfficialPricingFetchResponse(BaseModel):
    query_ids: list[int]
    total_lines: int
    priced_count: int
    missing_count: int
    error_count: int
    is_mock: bool


class SupplierResultCell(BaseModel):
    unit_price: float | None = None
    available_qty: float | None = None
    match_status: str | None = None
    is_exact_match: bool | None = None
    supplier_part_number: str | None = None
    lead_time: str | None = None
    currency: str | None = None


class OfficialPricingLineResult(BaseModel):
    bom_line_id: int
    line_no: int | None
    mpn: str | None
    cleaned_mpn: str | None
    manufacturer: str | None
    required_qty: float | None
    dnp: bool
    digikey: SupplierResultCell | None = None
    mouser: SupplierResultCell | None = None
    selected_official_source: str | None = None


class SupplierOffer(BaseModel):
    supplier: str
    supplier_display: str
    mpn: str | None = None
    matched_mpn: str | None = None
    supplier_part_number: str | None = None
    manufacturer: str | None = None
    unit_price: float | None = None
    extended_price: float | None = None
    stock: float | None = None
    price_break_qty: float | None = None
    match_status: str | None = None
    match_reason: str | None = None
    is_exact_match: bool = False
    product_url: str | None = None
    lead_time: str | None = None
    currency: str = "USD"
    needs_review: bool = False
    internal_only: bool = False
    source_type: str | None = None
    source_group: str | None = None
    comments: str | None = None
    total_price: float | None = None
    is_currently_selected: bool = False
    is_recommended: bool = False
    delta_vs_selected: float | None = None
    delta_vs_official_best: float | None = None
    savings_vs_official: float | None = None
    disabled_in_current_mode: bool = False
    disabled_reason: str | None = None


class LinePricingComparison(BaseModel):
    official_best_extended: float | None = None
    east_best_extended: float | None = None
    difference: float | None = None
    difference_percent: float | None = None
    has_official_price: bool = False
    has_east_price: bool = False


class WorkbenchLineResult(BaseModel):
    bom_line_id: int
    line_no: int | None
    mpn: str | None
    cleaned_mpn: str | None = None
    search_mpn: str | None = None
    search_mpn_override: str | None = None
    search_mpn_override_active: bool = False
    manufacturer: str | None
    description: str | None = None
    required_qty: float | None
    dnp: bool
    source: str
    supplier_part_number: str | None = None
    unit_price: float | None = None
    extended_price: float | None = None
    stock: float | None = None
    currency: str = "USD"
    lead_time: str | None = None
    status: str
    solution_status: str
    notes: str | None = None
    selected_supplier: str | None = None
    selected_source_type: str | None = None
    user_selected: bool = False
    offers: list[SupplierOffer] = Field(default_factory=list)
    source_is_internal: bool = False
    east_pricing_disabled_note: str | None = None
    line_pricing: LinePricingComparison | None = None
    recommended_supplier: str | None = None
    recommended_internal_only: bool = False


class PricingScenarioStats(BaseModel):
    total: float = 0
    priced_lines: int = 0
    needs_approval: int = 0
    no_solution: int = 0
    no_stock: int = 0
    east_selected_lines: int = 0


class PricingSavings(BaseModel):
    amount: float = 0
    percent: float | None = None
    is_saving: bool = False


class PricingComparison(BaseModel):
    official_only: PricingScenarioStats
    with_east: PricingScenarioStats
    savings: PricingSavings


class WorkbenchSummary(BaseModel):
    total_lines: int
    has_solution: int
    needs_approval: int
    no_solution: int
    dnp: int
    selected_total_cost: float


class WorkbenchResultsResponse(BaseModel):
    project_id: int
    bom_version_id: int
    config: SupplierConfigStatus
    summary: WorkbenchSummary
    lines: list[WorkbenchLineResult]
    include_east_pricing: bool = False
    east_quotes: list[dict] = Field(default_factory=list)
    pricing_comparison: PricingComparison | None = None


class EastQuoteSummary(BaseModel):
    id: int
    supplier_name: str
    source_filename: str | None = None
    sheet_name: str | None = None
    board_name: str | None = None
    doc_number: str | None = None
    revised_date: str | None = None
    currency: str = "USD"
    total_price_summary: float | None = None
    is_active: bool = False
    status: str
    lines_count: int = 0
    matched_count: int = 0
    created_at: datetime | None = None
    uploaded_at: datetime | None = None


class EastQuoteUploadResult(BaseModel):
    quote_id: int
    supplier_name: str
    source_filename: str
    board_name: str | None = None
    doc_number: str | None = None
    revised_date: str | None = None
    lines_imported: int
    dnp_count: int = 0
    match_summary: dict
    is_active: bool = True


class IncludeEastPricingRequest(BaseModel):
    bom_version_id: int
    include_east_pricing: bool


class SelectOfferRequest(BaseModel):
    project_id: int
    bom_version_id: int
    bom_line_id: int
    offer_type: str  # supplier | manual | tbd | dnp
    supplier: str | None = None
    manually_approved_possible_match: bool = False


class ManualSourceRequest(BaseModel):
    project_id: int
    bom_version_id: int
    bom_line_id: int
    supplier_name: str
    supplier_part_number: str | None = None
    unit_price: float
    currency: str = "USD"
    stock: float | None = None
    lead_time: str | None = None
    note: str | None = None


class MpnOverrideRequest(BaseModel):
    project_id: int
    bom_version_id: int
    bom_line_id: int
    search_mpn_override: str | None = None


class FetchLineRequest(BaseModel):
    project_id: int
    bom_version_id: int
    bom_line_id: int
    suppliers: list[str] = Field(default_factory=lambda: ["digikey", "mouser"])


class WorkbenchExportRequest(BaseModel):
    project_id: int
    bom_version_id: int


class OfficialPricingResultsResponse(BaseModel):
    project_id: int
    bom_version_id: int
    config: SupplierConfigStatus
    lines: list[OfficialPricingLineResult]


class OfficialSnapshotCreateRequest(BaseModel):
    project_id: int
    bom_version_id: int
    snapshot_name: str
    supplier_priority: list[str] = Field(default_factory=lambda: ["digikey", "mouser"])


class OfficialSnapshotCreateResponse(BaseModel):
    snapshot_id: int
    priced_count: int
    missing_price_count: int
    needs_review_count: int
    official_components_total: float
    is_mock: bool


class OfficialPriceLineRead(ORMModel):
    id: int
    bom_line_id: int
    selected_supplier: str | None
    selected_supplier_part_number: str | None
    official_source: str | None
    official_unit_price: float | None
    official_extended_price: float | None
    required_qty: float | None
    availability_status: str | None
    lead_time: str | None
    pricing_status: str
    notes: str | None


class OfficialPriceSnapshotRead(ORMModel):
    id: int
    project_id: int
    bom_version_id: int
    snapshot_name: str
    created_by_user_id: int | None
    created_at: datetime
    status: str
    is_mock: bool
    lines: list[OfficialPriceLineRead] = Field(default_factory=list)
