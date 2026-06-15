from pydantic import BaseModel


class BomPreview(BaseModel):
    file_path: str
    file_name: str
    columns: list[str]
    rows: list[list[str]]
    total_rows: int
    suggested_mapping: dict[str, str | None]


class BomImportCommit(BaseModel):
    project_id: int
    version_label: str
    status: str = "Draft"
    source: str | None = "excel-import"
    file_path: str
    # Maps a BOM line field (e.g. "mpn") to a column header from the preview.
    mapping: dict[str, str | None]
    set_active: bool = False


class BomImportResult(BaseModel):
    bom_version_id: int
    line_count: int
    project_id: int
    version_label: str
