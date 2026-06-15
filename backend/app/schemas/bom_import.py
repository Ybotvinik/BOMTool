from pydantic import BaseModel


class CandidateHeaderRow(BaseModel):
    row_index: int
    values: list[str]
    non_empty_count: int
    keyword_hits: int


class ExtractedMetadata(BaseModel):
    board_name: str | None = None
    doc_number: str | None = None
    revised_date: str | None = None
    revision: str | None = None
    bom_number: str | None = None
    revision_code: str | None = None


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
    extracted_metadata: ExtractedMetadata
    suggested_version_name: str
    suggested_revision_code: str | None = None
    warning: str | None = None


class BomImportCommit(BaseModel):
    project_id: int
    # Preferred field for the version name; ``version_label`` kept as alias.
    version_name: str | None = None
    version_label: str | None = None
    revision_code: str | None = None
    extracted_metadata: ExtractedMetadata | None = None
    status: str = "Draft"
    source: str | None = "excel-import"
    file_path: str
    sheet_name: str | None = None
    header_row_index: int | None = None
    # Maps a BOM line field (e.g. "mpn") to a column header from the preview.
    mapping: dict[str, str | None]
    set_active: bool = True


class BomImportResult(BaseModel):
    success: bool = True
    project_id: int
    bom_version_id: int
    version_name: str
    revision_code: str | None = None
    # True when the requested version_name already existed and we auto-suffixed.
    conflict: bool = False
    rows_imported: int
    skipped_rows: int
    missing_mpn_count: int = 0
    missing_qty_count: int = 0
    dnp_count: int = 0
    needs_review_count: int = 0
    # Backwards-compatible aliases.
    line_count: int
    version_label: str
