from pydantic import BaseModel


class CandidateHeaderRow(BaseModel):
    row_index: int
    values: list[str]
    non_empty_count: int
    keyword_hits: int


class BomPreview(BaseModel):
    file_path: str
    file_name: str
    sheet_name: str
    sheet_names: list[str]
    # Zero-based row indices. ``detected_header_row_index`` is the auto-detected
    # header; ``header_row_index`` is the one actually used for this response
    # (equals the manual override when provided).
    detected_header_row_index: int | None
    header_row_index: int | None
    columns: list[str]
    rows: list[list[str]]
    total_rows: int
    metadata_rows: list[list[str]]
    candidate_header_rows: list[CandidateHeaderRow]
    suggested_mapping: dict[str, str | None]
    warning: str | None = None


class BomImportCommit(BaseModel):
    project_id: int
    version_label: str
    status: str = "Draft"
    source: str | None = "excel-import"
    file_path: str
    sheet_name: str | None = None
    header_row_index: int | None = None
    # Maps a BOM line field (e.g. "mpn") to a column header from the preview.
    mapping: dict[str, str | None]
    set_active: bool = False


class BomImportResult(BaseModel):
    success: bool = True
    project_id: int
    bom_version_id: int
    version_name: str
    rows_imported: int
    skipped_rows: int
    missing_mpn_count: int = 0
    missing_qty_count: int = 0
    dnp_count: int = 0
    needs_review_count: int = 0
    # Backwards-compatible aliases.
    line_count: int
    version_label: str
