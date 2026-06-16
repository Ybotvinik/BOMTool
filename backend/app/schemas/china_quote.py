from datetime import datetime

from pydantic import BaseModel

from app.schemas.bom_import import CandidateHeaderRow
from app.schemas.common import ORMModel


class ChinaQuotePreview(BaseModel):
    file_id: str
    file_name: str
    sheet_name: str
    sheet_names: list[str]
    detected_header_row_index: int | None
    header_row_index: int | None
    columns: list[str]
    rows: list[list[str]]
    total_rows: int
    candidate_header_rows: list[CandidateHeaderRow]
    suggested_mapping: dict[str, str | None]
    warning: str | None = None


class ChinaQuoteImport(BaseModel):
    project_id: int
    bom_version_id: int | None = None
    file_id: str
    quote_name: str
    supplier_name: str
    currency: str = "USD"
    selected_sheet: str | None = None
    header_row_index: int | None = None
    column_mapping: dict[str, str | None]


class ChinaQuoteImportResult(BaseModel):
    supplier_quote_id: int
    lines_imported: int
    matched_count: int
    possible_match_count: int
    not_matched_count: int
    currency: str
    quote_name: str
    supplier_name: str
    total_rows_scanned: int = 0
    lines_skipped: int = 0
    missing_mpn_count: int = 0
    missing_price_count: int = 0
    skipped_rows_sample: list[str] = []


class ChinaMatchUpdate(BaseModel):
    bom_line_id: int | None = None
    match_status: str | None = None
    match_confidence: int | None = None
    match_reason: str | None = None


class ChinaQuoteRead(ORMModel):
    id: int
    project_id: int
    bom_version_id: int | None
    quote_name: str | None
    supplier_name: str
    source_type: str
    currency: str
    status: str
    source_file_name: str | None
    uploaded_at: datetime | None
    created_at: datetime
