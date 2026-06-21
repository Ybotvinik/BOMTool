"""Schemas for single-component official price lookups."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ComponentLookupOffer(BaseModel):
    supplier: str
    supplier_display: str
    matched_mpn: str | None = None
    manufacturer: str | None = None
    description: str | None = None
    supplier_part_number: str | None = None
    product_url: str | None = None
    currency: str = "USD"
    unit_price: float | None = None
    price_break_qty: float | None = None
    available_qty: float | None = None
    lead_time: str | None = None
    lifecycle_status: str | None = None
    is_exact_match: bool = False
    match_status: str
    match_reason: str | None = None


class ComponentLookupAdditionRead(BaseModel):
    id: int
    project_id: int
    bom_version_id: int
    bom_line_id: int
    created_at: datetime


class PreviousLookupProjectRef(BaseModel):
    project_id: int
    project_name: str | None = None
    bom_version_id: int
    bom_line_id: int


class PreviousLookupRef(BaseModel):
    id: int
    search_mpn: str
    required_qty: float
    created_at: datetime
    last_checked_at: datetime
    added_to_projects: list[PreviousLookupProjectRef] = Field(default_factory=list)


class BomPresenceRef(BaseModel):
    project_id: int
    project_name: str
    project_code: str | None = None
    bom_version_id: int
    version_label: str
    version_name: str | None = None
    bom_line_id: int
    line_no: int | None = None
    mpn: str | None = None
    in_purchase_report: bool = False
    source: str | None = None
    unit_price: float | None = None
    status: str | None = None
    solution_status: str | None = None


class ChinaQuoteRef(BaseModel):
    quote_id: int
    quote_name: str | None = None
    supplier_name: str
    quote_source_type: str = "china"
    project_id: int
    project_name: str
    quoted_mpn: str | None = None
    unit_price: float | None = None
    currency: str | None = None
    is_active: bool = False
    match_status: str | None = None
    quote_date: datetime | None = None
    created_at: datetime | None = None


class MpnCrossReferenceSummary(BaseModel):
    projects_seen: list[str] = Field(default_factory=list)
    projects_with_bom_line: list[str] = Field(default_factory=list)
    projects_in_purchase_report: list[str] = Field(default_factory=list)
    in_purchase_report_any: bool = False
    china_quote_hit: bool = False
    china_quote_count: int = 0


class MpnCrossReferences(BaseModel):
    cleaned_mpn: str | None = None
    is_partial_match: bool = False
    previously_searched: bool = False
    previous_lookup_count: int = 0
    previous_lookups: list[PreviousLookupRef] = Field(default_factory=list)
    bom_presence: list[BomPresenceRef] = Field(default_factory=list)
    china_quotes: list[ChinaQuoteRef] = Field(default_factory=list)
    summary: MpnCrossReferenceSummary = Field(default_factory=MpnCrossReferenceSummary)


class ComponentLookupRead(BaseModel):
    id: int
    search_mpn: str
    cleaned_mpn: str | None = None
    manufacturer_hint: str | None = None
    required_qty: float
    note: str | None = None
    is_mock: bool
    created_by_user_id: int | None = None
    created_at: datetime
    last_checked_at: datetime
    offers: list[ComponentLookupOffer] = Field(default_factory=list)
    project_additions: list[ComponentLookupAdditionRead] = Field(default_factory=list)
    cross_references: MpnCrossReferences = Field(default_factory=MpnCrossReferences)


class ComponentLookupSummary(BaseModel):
    id: int
    search_mpn: str
    cleaned_mpn: str | None = None
    required_qty: float
    note: str | None = None
    is_mock: bool
    created_at: datetime
    last_checked_at: datetime
    best_supplier: str | None = None
    best_supplier_display: str | None = None
    best_unit_price: float | None = None
    priced_suppliers: int = 0
    additions_count: int = 0
    previous_lookup_count: int = 0
    previously_searched: bool = False


class ComponentLookupListResponse(BaseModel):
    items: list[ComponentLookupSummary]
    offset: int
    limit: int
    has_more: bool


class ComponentLookupCreateRequest(BaseModel):
    mpn: str
    required_qty: float = 1
    manufacturer_hint: str | None = None
    note: str | None = None
    suppliers: list[str] = Field(default_factory=lambda: ["digikey", "mouser", "ti"])


class ComponentLookupRefreshRequest(BaseModel):
    suppliers: list[str] = Field(default_factory=lambda: ["digikey", "mouser", "ti"])


class ComponentLookupAddToProjectRequest(BaseModel):
    project_id: int
    bom_version_id: int
    quantity_per_assembly: float = 1
    reference_designators: str | None = None
    notes: str | None = None
    preferred_supplier: str | None = None


class ComponentLookupAddToProjectResponse(BaseModel):
    lookup_id: int
    project_id: int
    bom_version_id: int
    bom_line_id: int
    line_no: int
    mpn: str
