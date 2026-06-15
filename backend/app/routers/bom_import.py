from __future__ import annotations

import logging
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user_id
from app.models import BomLine, BomVersion, Project
from app.schemas.bom_import import (
    BomImportCommit,
    BomImportResult,
    BomPreview,
    CandidateHeaderRow,
)
from app.services.activity import log_activity
from app.services.bom_parser import (
    clean_display,
    detect_header_row,
    list_sheets_and_rows,
    suggest_mapping,
)
from app.services.file_storage import get_file_storage

router = APIRouter(prefix="/bom-import", tags=["bom_import"])

PREVIEW_ROWS = 10
NO_HEADER_WARNING = "לא זוהתה שורת כותרות BOM. יש לבחור ידנית את שורת הכותרות."

# String/numeric BOM line fields that can be mapped from columns.
_TEXT_FIELDS = {
    "mpn",
    "manufacturer",
    "description",
    "reference_designators",
    "footprint",
    "value",
    "supplier_part_number",
    "unit",
}


@router.post("/preview", response_model=BomPreview)
async def preview_bom(
    file: UploadFile | None = File(default=None),
    file_path: str | None = Form(default=None),
    sheet_name: str | None = Form(default=None),
    header_row_index: int | None = Form(default=None),
) -> BomPreview:
    """Parse an uploaded BOM and return a preview, candidate header rows, the
    metadata rows above the header, and a suggested column mapping.

    Accepts either a new ``file`` upload (persisted via FileStorageService) or a
    ``file_path`` of a previously uploaded file (used when the user changes the
    header row / sheet without re-uploading). ``header_row_index`` (zero-based)
    overrides auto-detection; ``sheet_name`` selects a worksheet.
    """
    storage = get_file_storage()

    if file is not None:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Empty file")
        stored = storage.save(content, file.filename or "upload.xlsx", subdir="bom-imports")
        path, display_name, source_name = stored.path, stored.file_name, file.filename or "upload.xlsx"
    elif file_path:
        try:
            content = storage.read(file_path)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="Uploaded file not found; re-upload")
        path = file_path
        display_name = file_path.split("/")[-1]
        source_name = file_path
    else:
        raise HTTPException(status_code=400, detail="Provide a file or file_path")

    try:
        sheet_names, active_sheet, rows = list_sheets_and_rows(content, source_name, sheet_name)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not parse file: {exc}")

    detected_index, candidates = detect_header_row(rows)

    warning: str | None = None
    used_index: int | None
    if header_row_index is not None:
        if header_row_index < 0 or header_row_index >= len(rows):
            raise HTTPException(status_code=400, detail="header_row_index out of range")
        used_index = header_row_index
    else:
        used_index = detected_index
        if used_index is None:
            warning = NO_HEADER_WARNING

    columns: list[str] = []
    preview_rows: list[list[str]] = []
    metadata_rows: list[list[str]] = []
    total_rows = 0
    suggested: dict[str, str | None] = {}

    if used_index is not None:
        header = rows[used_index]
        columns = [clean_display(c) for c in header]
        metadata_rows = [
            [clean_display(c) for c in r] for r in rows[:used_index] if any(x.strip() for x in r)
        ]
        data_rows = [r for r in rows[used_index + 1 :] if any(x.strip() for x in r)]
        total_rows = len(data_rows)
        preview_rows = [[clean_display(c) for c in r] for r in data_rows[:PREVIEW_ROWS]]
        suggested = suggest_mapping(columns)

    return BomPreview(
        file_path=path,
        file_name=display_name,
        sheet_name=active_sheet,
        sheet_names=sheet_names,
        detected_header_row_index=detected_index,
        header_row_index=used_index,
        columns=columns,
        rows=preview_rows,
        total_rows=total_rows,
        metadata_rows=metadata_rows,
        candidate_header_rows=[CandidateHeaderRow(**c) for c in candidates],
        suggested_mapping=suggested,
        warning=warning,
    )


def _to_decimal(value: str) -> Decimal | None:
    value = (value or "").strip().replace(",", "").replace("$", "")
    if not value:
        return None
    try:
        return Decimal(value)
    except (InvalidOperation, ValueError):
        return None


def _to_bool(value: str) -> bool:
    return (value or "").strip().lower() in {
        "1",
        "true",
        "yes",
        "y",
        "x",
        "כן",
        "critical",
        "dnp",
        "dni",
    }


@router.post("/commit", response_model=BomImportResult)
def commit_bom(
    payload: BomImportCommit,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> BomImportResult:
    """Create a BOM version and its lines from a previously previewed file.

    Rows above ``header_row_index`` (metadata), fully empty rows, and rows with
    no mapped field values are skipped.
    """
    project = db.get(Project, payload.project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    storage = get_file_storage()
    try:
        content = storage.read(payload.file_path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Uploaded file not found; re-upload")

    _, selected_sheet, rows = list_sheets_and_rows(content, payload.file_path, payload.sheet_name)

    header_index = payload.header_row_index
    if header_index is None:
        header_index, _ = detect_header_row(rows)
    if header_index is None or header_index >= len(rows):
        raise HTTPException(status_code=400, detail=NO_HEADER_WARNING)

    header = [clean_display(c) for c in rows[header_index]]
    col_index = {h: i for i, h in enumerate(header) if h}
    mapping = payload.mapping

    def cell(row: list[str], field: str) -> str:
        column = mapping.get(field)
        if not column or column not in col_index:
            return ""
        idx = col_index[column]
        return clean_display(row[idx]) if idx < len(row) else ""

    # A row is a valid BOM line if it has at least one of these (when mapped).
    # We do NOT skip a row just because one optional mapped field is empty.
    validity_fields = [
        f
        for f in ("mpn", "description", "reference_designators", "quantity", "value", "footprint")
        if mapping.get(f) and mapping[f] in col_index
    ]
    data_rows = rows[header_index + 1 :]
    log = logging.getLogger("bom.import")
    log.info(
        "BOM import: project_id=%s file_id=%s sheet=%s header_row_index=%s mapping=%s data_rows_parsed=%s",
        payload.project_id,
        payload.file_path,
        selected_sheet,
        header_index,
        mapping,
        len(data_rows),
    )

    version = BomVersion(
        project_id=payload.project_id,
        version_label=payload.version_label,
        status=payload.status,
        source=payload.source,
        is_active=payload.set_active,
        created_by_id=user_id,
    )
    db.add(version)
    db.flush()

    line_count = 0
    skipped = 0
    missing_mpn = 0
    missing_qty = 0
    dnp_count = 0
    needs_review = 0
    for row in data_rows:
        if not any(c.strip() for c in row):
            continue  # fully empty row
        check = validity_fields or [f for f in mapping if mapping.get(f) and mapping[f] in col_index]
        if not any(cell(row, f).strip() for f in check):
            skipped += 1
            continue  # no meaningful values -> metadata / junk row
        line_count += 1
        mpn = cell(row, "mpn") or None
        qty = _to_decimal(cell(row, "quantity"))
        is_dnp = _to_bool(cell(row, "dnp"))
        has_qty = qty is not None and qty > 0
        if not mpn:
            missing_mpn += 1
        if not has_qty:
            missing_qty += 1
        if is_dnp:
            dnp_count += 1
        if not mpn or not has_qty:
            needs_review += 1
        db.add(
            BomLine(
                bom_version_id=version.id,
                line_no=line_count,
                mpn=mpn,
                manufacturer=cell(row, "manufacturer") or None,
                description=cell(row, "description") or None,
                quantity=qty if qty is not None else Decimal(0),
                reference_designators=cell(row, "reference_designators") or None,
                footprint=cell(row, "footprint") or None,
                value=cell(row, "value") or None,
                supplier_part_number=cell(row, "supplier_part_number") or None,
                unit=cell(row, "unit") or None,
                customer_price=_to_decimal(cell(row, "customer_price")),
                internal_cost=_to_decimal(cell(row, "internal_cost")),
                is_critical=_to_bool(cell(row, "is_critical")),
                dnp=is_dnp,
            )
        )

    if payload.set_active:
        # Ensure exactly one active version for this project.
        db.query(BomVersion).filter(
            BomVersion.project_id == payload.project_id,
            BomVersion.id != version.id,
        ).update({BomVersion.is_active: False})
        project.active_version_id = version.id

    db.flush()
    log.info(
        "BOM import done: bom_version_id=%s rows_inserted=%s skipped=%s active_version_id=%s",
        version.id,
        line_count,
        skipped,
        project.active_version_id,
    )
    log_activity(
        db,
        user_id=user_id,
        action_type="bom.import",
        project_id=payload.project_id,
        entity_type="bom_version",
        entity_name=version.version_label,
        change_summary=(
            f"Imported BOM '{version.version_label}' with {line_count} lines "
            f"(header row {header_index + 1}, {skipped} rows skipped) "
            f"from '{payload.file_path.split('/')[-1]}'"
        ),
        commit=False,
    )
    db.commit()
    db.refresh(version)

    return BomImportResult(
        success=True,
        project_id=payload.project_id,
        bom_version_id=version.id,
        version_name=version.version_label,
        rows_imported=line_count,
        skipped_rows=skipped,
        missing_mpn_count=missing_mpn,
        missing_qty_count=missing_qty,
        dnp_count=dnp_count,
        needs_review_count=needs_review,
        line_count=line_count,
        version_label=version.version_label,
    )
