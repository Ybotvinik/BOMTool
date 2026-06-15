from __future__ import annotations

import logging
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user_id
from app.models import BomVersion, Project, SupplierQuote, SupplierQuoteLine
from app.schemas.china_quote import (
    ChinaQuoteImport,
    ChinaQuoteImportResult,
    ChinaQuotePreview,
    ChinaQuoteRead,
)
from app.schemas.bom_import import CandidateHeaderRow
from app.services.activity import log_activity
from app.services.bom_parser import clean_display, detect_header_row, list_sheets_and_rows
from app.services.bom_quality import clean_mpn
from app.services.china_quote import suggest_china_mapping
from app.services.file_storage import get_file_storage
from app.services.mpn_match import match_quote_lines

log = logging.getLogger("china_quote")
router = APIRouter(prefix="/china-quotes", tags=["china_quotes"])
# Separate router mounted under /projects for project-scoped listing.
project_router = APIRouter(prefix="/projects", tags=["china_quotes"])

PREVIEW_ROWS = 10


def _to_decimal(value: str) -> Decimal | None:
    value = (value or "").strip().replace(",", "").replace("$", "")
    if not value:
        return None
    try:
        return Decimal(value)
    except (InvalidOperation, ValueError):
        return None


def _to_int(value: str) -> int | None:
    d = _to_decimal(value)
    return int(d) if d is not None else None


@router.post("/upload-preview", response_model=ChinaQuotePreview)
async def upload_preview(
    file: UploadFile | None = File(default=None),
    file_id: str | None = Form(default=None),
    project_id: int | None = Form(default=None),
    bom_version_id: int | None = Form(default=None),
    sheet_name: str | None = Form(default=None),
    header_row_index: int | None = Form(default=None),
) -> ChinaQuotePreview:
    storage = get_file_storage()
    if file is not None:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="קובץ ריק")
        stored = storage.save(content, file.filename or "china.xlsx", subdir="china-quotes")
        path, display_name, source_name = stored.path, stored.file_name, file.filename or "china.xlsx"
    elif file_id:
        try:
            content = storage.read(file_id)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="הקובץ לא נמצא; יש להעלות מחדש")
        path, display_name, source_name = file_id, file_id.split("/")[-1], file_id
    else:
        raise HTTPException(status_code=400, detail="יש לספק file או file_id")

    try:
        sheet_names, active_sheet, rows = list_sheets_and_rows(content, source_name, sheet_name)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"שגיאת קריאת קובץ: {exc}")

    detected_index, candidates = detect_header_row(rows)
    warning: str | None = None
    used_index = header_row_index if header_row_index is not None else detected_index
    if used_index is not None and (used_index < 0 or used_index >= len(rows)):
        raise HTTPException(status_code=400, detail="header_row_index out of range")

    columns: list[str] = []
    preview_rows: list[list[str]] = []
    total_rows = 0
    suggested: dict[str, str | None] = {}
    if used_index is not None:
        columns = [clean_display(c) for c in rows[used_index]]
        data_rows = [r for r in rows[used_index + 1 :] if any(x.strip() for x in r)]
        total_rows = len(data_rows)
        preview_rows = [[clean_display(c) for c in r] for r in data_rows[:PREVIEW_ROWS]]
        suggested = suggest_china_mapping(columns)
    else:
        warning = "לא זוהתה שורת כותרות. יש לבחור ידנית את שורת הכותרות."

    return ChinaQuotePreview(
        file_id=path,
        file_name=display_name,
        sheet_name=active_sheet,
        sheet_names=sheet_names,
        detected_header_row_index=detected_index,
        header_row_index=used_index,
        columns=columns,
        rows=preview_rows,
        total_rows=total_rows,
        candidate_header_rows=[CandidateHeaderRow(**c) for c in candidates],
        suggested_mapping=suggested,
        warning=warning,
    )


@router.post("/import", response_model=ChinaQuoteImportResult)
def import_china_quote(
    payload: ChinaQuoteImport,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> ChinaQuoteImportResult:
    project = db.get(Project, payload.project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="פרויקט לא נמצא")
    if payload.bom_version_id is not None and db.get(BomVersion, payload.bom_version_id) is None:
        raise HTTPException(status_code=404, detail="גרסת BOM לא נמצאה")

    mapping = payload.column_mapping or {}
    if not mapping.get("quoted_mpn") or not mapping.get("unit_price"):
        raise HTTPException(
            status_code=400,
            detail="חובה למפות לפחות MPN ומחיר יחידה (Unit Price)",
        )

    storage = get_file_storage()
    try:
        content = storage.read(payload.file_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="הקובץ לא נמצא; יש להעלות מחדש")

    _, selected_sheet, rows = list_sheets_and_rows(content, payload.file_id, payload.selected_sheet)
    header_index = payload.header_row_index
    if header_index is None:
        header_index, _ = detect_header_row(rows)
    if header_index is None or header_index >= len(rows):
        raise HTTPException(status_code=400, detail="לא זוהתה שורת כותרות")

    header = [clean_display(c) for c in rows[header_index]]
    col_index = {h: i for i, h in enumerate(header) if h}

    def cell(row: list[str], field: str) -> str:
        column = mapping.get(field)
        if not column or column not in col_index:
            return ""
        idx = col_index[column]
        return clean_display(row[idx]) if idx < len(row) else ""

    now = datetime.now(timezone.utc)
    quote = SupplierQuote(
        project_id=payload.project_id,
        bom_version_id=payload.bom_version_id,
        quote_name=payload.quote_name,
        supplier_name=payload.supplier_name,
        source_type="china",
        currency=payload.currency or "USD",
        source_file_name=payload.file_id.split("/")[-1],
        status="Imported",
        created_by_id=user_id,
        uploaded_by_user_id=user_id,
        uploaded_at=now,
    )
    db.add(quote)
    db.flush()

    lines_imported = 0
    for row in rows[header_index + 1 :]:
        if not any(c.strip() for c in row):
            continue
        quoted_mpn = cell(row, "quoted_mpn")
        if not quoted_mpn and not cell(row, "supplier_part_number"):
            continue
        lines_imported += 1
        currency = cell(row, "currency") or payload.currency or "USD"
        db.add(
            SupplierQuoteLine(
                supplier_quote_id=quote.id,
                line_number=lines_imported,
                mpn=quoted_mpn or None,
                quoted_mpn=quoted_mpn or None,
                cleaned_quoted_mpn=clean_mpn(quoted_mpn),
                manufacturer=cell(row, "manufacturer") or None,
                description=cell(row, "description") or None,
                supplier_part_number=cell(row, "supplier_part_number") or None,
                unit_price=_to_decimal(cell(row, "unit_price")),
                currency=currency,
                moq=_to_int(cell(row, "moq")),
                available_qty=_to_int(cell(row, "available_qty")),
                stock=_to_int(cell(row, "available_qty")),
                lead_time=cell(row, "lead_time") or None,
                notes=cell(row, "notes") or None,
                match_status="not_matched",
                match_confidence=0,
            )
        )

    db.flush()
    summary = match_quote_lines(db, quote.id, payload.bom_version_id)
    log_activity(
        db,
        user_id=user_id,
        action_type="china_quote_uploaded",
        project_id=payload.project_id,
        entity_type="supplier_quote",
        entity_name=payload.quote_name,
        change_summary=(
            f"Imported China quote '{payload.quote_name}' from '{quote.source_file_name}' "
            f"({lines_imported} lines, {summary['matched_count']} matched, "
            f"{summary['possible_match_count']} possible, {summary['not_matched_count']} unmatched)"
        ),
        commit=False,
    )
    db.commit()

    return ChinaQuoteImportResult(
        supplier_quote_id=quote.id,
        lines_imported=lines_imported,
        matched_count=summary["matched_count"],
        possible_match_count=summary["possible_match_count"],
        not_matched_count=summary["not_matched_count"],
        currency=quote.currency,
        quote_name=quote.quote_name or "",
        supplier_name=quote.supplier_name,
    )


@router.get("/{supplier_quote_id}/lines")
def list_quote_lines(supplier_quote_id: int, db: Session = Depends(get_db)) -> list[dict]:
    quote = db.get(SupplierQuote, supplier_quote_id)
    if quote is None:
        raise HTTPException(status_code=404, detail="הצעת מחיר לא נמצאה")
    lines = list(
        db.scalars(
            select(SupplierQuoteLine)
            .where(SupplierQuoteLine.supplier_quote_id == supplier_quote_id)
            .order_by(SupplierQuoteLine.line_number, SupplierQuoteLine.id)
        )
    )
    out = []
    for ln in lines:
        matched_bom = None
        if ln.matched_bom_line_id is not None:
            from app.models import BomLine

            bl = db.get(BomLine, ln.matched_bom_line_id)
            if bl is not None:
                matched_bom = {"id": bl.id, "mpn": bl.mpn, "cleaned_mpn": bl.cleaned_mpn}
        out.append(
            {
                "id": ln.id,
                "line_number": ln.line_number,
                "quoted_mpn": ln.quoted_mpn,
                "cleaned_quoted_mpn": ln.cleaned_quoted_mpn,
                "manufacturer": ln.manufacturer,
                "description": ln.description,
                "supplier_part_number": ln.supplier_part_number,
                "unit_price": float(ln.unit_price) if ln.unit_price is not None else None,
                "currency": ln.currency,
                "moq": ln.moq,
                "available_qty": ln.available_qty,
                "lead_time": ln.lead_time,
                "notes": ln.notes,
                "matched_bom_line_id": ln.matched_bom_line_id,
                "matched_bom_line": matched_bom,
                "match_status": ln.match_status,
                "match_confidence": ln.match_confidence,
                "match_reason": ln.match_reason,
            }
        )
    return out


@router.post("/{supplier_quote_id}/match")
def rematch_quote(
    supplier_quote_id: int,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> dict:
    quote = db.get(SupplierQuote, supplier_quote_id)
    if quote is None:
        raise HTTPException(status_code=404, detail="הצעת מחיר לא נמצאה")
    summary = match_quote_lines(db, supplier_quote_id, quote.bom_version_id)
    log_activity(
        db,
        user_id=user_id,
        action_type="china_quote_matched",
        project_id=quote.project_id,
        entity_type="supplier_quote",
        entity_name=quote.quote_name,
        change_summary=(
            f"Re-matched China quote '{quote.quote_name}': "
            f"{summary['matched_count']} matched, {summary['possible_match_count']} possible, "
            f"{summary['not_matched_count']} unmatched"
        ),
        commit=False,
    )
    db.commit()
    return {"supplier_quote_id": supplier_quote_id, **summary}


@project_router.get("/{project_id}/china-quotes", response_model=list[ChinaQuoteRead])
def list_project_quotes(project_id: int, db: Session = Depends(get_db)) -> list[SupplierQuote]:
    return list(
        db.scalars(
            select(SupplierQuote)
            .where(
                SupplierQuote.project_id == project_id,
                SupplierQuote.source_type == "china",
            )
            .order_by(SupplierQuote.id.desc())
        )
    )
