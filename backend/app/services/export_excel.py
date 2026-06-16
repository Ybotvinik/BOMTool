"""Excel export builders for customer-safe and internal reports."""

from __future__ import annotations

import io
import re
from copy import copy
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.formula.translate import Translator
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import BomLine, BomVersion, Customer, PricingLine, PricingSnapshot, Project

# Official/market prices in this export are reference prices only — not final customer
# quote prices. Customer Quote Price is a future commercial pricing layer.
# Internal/China costs must never be exposed in customer exports.
# Official Unit Price is populated only when notes contain an explicit official source.

CUSTOMER_TEMPLATE_PATH = (
    Path(__file__).resolve().parent.parent / "templates" / "customer_bom_cost_review_template.xlsx"
)
CUSTOMER_SHEET_NAME = "Customer BOM Cost Review"
TEMPLATE_TABLE_HEADER_ROW = 15
TEMPLATE_DATA_START_ROW = 16
TEMPLATE_DATA_DEFAULT_END_ROW = 90
TEMPLATE_TABLE_COLS = 12

_COL_LINE = 1
_COL_MPN = 2
_COL_MANUFACTURER = 3
_COL_DESCRIPTION = 4
_COL_QTY = 5
_COL_REQ_QTY = 6
_COL_REFDES = 7
_COL_FOOTPRINT = 8
_COL_OFFICIAL_SOURCE = 9
_COL_OFFICIAL_UNIT = 10
_COL_OFFICIAL_EXTENDED = 11
_COL_NOTES = 12

# Backward-compatible aliases used by column index logic.
_COL_PRICE_SOURCE = _COL_OFFICIAL_SOURCE
_COL_UNIT_PRICE = _COL_OFFICIAL_UNIT
_COL_EXTENDED = _COL_OFFICIAL_EXTENDED

USD_CURRENCY_FMT = '"$"#,##0.00'
USD_UNIT_FMT = '"$"#,##0.0000'
QTY_INT_FMT = "#,##0"

_METADATA_BUILD_QTY = "G9"

_DNP_FILL = PatternFill(fill_type="solid", fgColor="D9D9D9")
_DNP_FONT_COLOR = "808080"
_DNP_NOTE = "DNP / Not populated"

_FORBIDDEN_CUSTOMER_HEADER_PHRASES = (
    "china",
    "internal",
    "margin",
    "savings",
    "confidence",
    "buyer",
    "match confidence",
    "internal cost",
    "china cost",
    "unit cost",
    "extended cost",
    "gross margin",
    "customer unit price",
    "customer extended price",
    "customer price source",
    "customer price list",
    "official price list",
    "generic price list",
)

# (needle, canonical label) — longest needles first for matching in BOM line notes.
_OFFICIAL_SOURCE_PATTERNS: tuple[tuple[str, str], ...] = (
    ("future electronics", "Future"),
    ("manual official", "Manual Official"),
    ("official rep", "Official Rep"),
    ("digi-key", "Digi-Key"),
    ("digikey", "Digi-Key"),
    ("mouser", "Mouser"),
    ("arrow", "Arrow"),
    ("avnet", "Avnet"),
    ("future", "Future"),
    ("tti", "TTI"),
)

_FORBIDDEN_OFFICIAL_SOURCE_VALUES = frozenset(
    {
        "official price list",
        "customer price list",
        "generic price list",
        "price list",
        "official/market price list",
    }
)


def _safe_part(value: str | None) -> str:
    if not value:
        return "unknown"
    return re.sub(r"[^\w\-]+", "_", str(value).strip()).strip("_") or "unknown"


def _num(value: Decimal | float | int | None) -> float | None:
    if value is None:
        return None
    return float(value)


def _autosize(ws) -> None:
    for col_idx, column_cells in enumerate(ws.columns, start=1):
        max_len = 0
        for cell in column_cells:
            if cell.value is not None:
                max_len = max(max_len, len(str(cell.value)))
        ws.column_dimensions[get_column_letter(col_idx)].width = min(max_len + 2, 48)


def _write_header_block(ws, rows: list[tuple[str, str]]) -> None:
    bold = Font(bold=True)
    for label, val in rows:
        ws.append([label, val])
        ws.cell(row=ws.max_row, column=1).font = bold
    ws.append([])


def _validate_customer_export_headers(headers: list[str]) -> None:
    """Reject customer exports that accidentally include internal-only columns."""
    for header in headers:
        if not header:
            continue
        lower = str(header).lower().strip()
        if any(phrase in lower for phrase in _FORBIDDEN_CUSTOMER_HEADER_PHRASES):
            raise ValueError(
                f"Unsafe customer export header '{header}': contains forbidden internal term"
            )


def _copy_cell_style(src, dst) -> None:
    if not src.has_style:
        return
    dst.font = copy(src.font)
    dst.border = copy(src.border)
    dst.fill = copy(src.fill)
    dst.number_format = src.number_format
    dst.protection = copy(src.protection)
    dst.alignment = copy(src.alignment)


def _snapshot_row_styles(ws, row: int, max_col: int = TEMPLATE_TABLE_COLS) -> list:
    return [ws.cell(row=row, column=c) for c in range(1, max_col + 1)]


def _apply_row_styles(ws, row: int, style_sources: list) -> None:
    for col_idx, src in enumerate(style_sources, start=1):
        _copy_cell_style(src, ws.cell(row=row, column=col_idx))


def _apply_dnp_row_styles(ws, row: int, style_sources: list) -> None:
    """Gray out entire DNP data row while preserving borders/alignment."""
    for col_idx, src in enumerate(style_sources, start=1):
        cell = ws.cell(row=row, column=col_idx)
        _copy_cell_style(src, cell)
        cell.fill = _DNP_FILL
        if cell.font:
            cell.font = Font(
                name=cell.font.name,
                size=cell.font.size,
                bold=cell.font.bold,
                italic=cell.font.italic,
                underline=cell.font.underline,
                strikethrough=cell.font.strikethrough,
                color=_DNP_FONT_COLOR,
            )
        else:
            cell.font = Font(color=_DNP_FONT_COLOR)


def _is_dnp_line(line: BomLine) -> bool:
    if line.dnp:
        return True
    if line.required_qty is not None and float(line.required_qty) == 0:
        return True
    return False


def _load_customer_template_sheet():
    if not CUSTOMER_TEMPLATE_PATH.is_file():
        raise FileNotFoundError(
            f"Customer BOM template not found: {CUSTOMER_TEMPLATE_PATH}"
        )
    wb = load_workbook(CUSTOMER_TEMPLATE_PATH)
    if CUSTOMER_SHEET_NAME in wb.sheetnames:
        ws = wb[CUSTOMER_SHEET_NAME]
    else:
        ws = wb.active
    ws.sheet_view.rightToLeft = False
    return wb, ws


def _fill_customer_template_metadata(
    ws,
    *,
    customer_name: str,
    project_name: str,
    project_code: str,
    version_label: str,
    revision: str,
    doc_number: str,
    board_name: str,
    build_qty: int,
    export_date: str,
) -> None:
    """Fill project header + summary qty cells defined by the template layout."""
    ws["B4"] = customer_name
    ws["D4"] = project_name
    ws["G4"] = project_code
    ws["B5"] = version_label
    ws["D5"] = revision
    ws["G5"] = doc_number
    ws["B6"] = board_name
    ws["D6"] = build_qty if build_qty > 0 else ""
    ws["G6"] = export_date
    ws[_METADATA_BUILD_QTY] = build_qty if build_qty > 0 else ""
    if build_qty > 0:
        ws[_METADATA_BUILD_QTY].number_format = QTY_INT_FMT


def _cell_has_formula(cell) -> bool:
    value = cell.value
    return isinstance(value, str) and value.startswith("=")


def _snapshot_template_extended_formula(ws) -> str | None:
    """Capture the row-level extended price formula from the template."""
    value = ws.cell(
        row=TEMPLATE_DATA_START_ROW, column=_COL_OFFICIAL_EXTENDED
    ).value
    if isinstance(value, str) and value.startswith("="):
        return value
    return None


def _apply_template_extended_formula(ws, row: int, template_formula: str) -> None:
    """Copy the template extended-price formula to another data row."""
    ext_col = get_column_letter(_COL_OFFICIAL_EXTENDED)
    origin = f"{ext_col}{TEMPLATE_DATA_START_ROW}"
    dest = f"{ext_col}{row}"
    ws.cell(row=row, column=_COL_OFFICIAL_EXTENDED).value = Translator(
        template_formula, origin=origin
    ).translate_formula(dest)


def _clear_bom_row_values(ws, start: int, end: int) -> None:
    """Clear prior BOM sample values; preserve existing extended-price formulas."""
    for row in range(start, end + 1):
        for col in range(1, TEMPLATE_TABLE_COLS + 1):
            if col == _COL_OFFICIAL_EXTENDED and _cell_has_formula(
                ws.cell(row=row, column=col)
            ):
                continue
            ws.cell(row=row, column=col).value = None


def customer_bom_review_filename(project_code: str, version_name: str) -> str:
    return f"Customer_BOM_Review_{_safe_part(project_code)}_{_safe_part(version_name)}.xlsx"


def internal_bom_quality_filename(project_code: str, version_name: str) -> str:
    return f"Internal_BOM_Quality_{_safe_part(project_code)}_{_safe_part(version_name)}.xlsx"


def internal_pricing_snapshot_filename(project_code: str, snapshot_name: str) -> str:
    return f"Internal_Pricing_{_safe_part(project_code)}_{_safe_part(snapshot_name)}.xlsx"


def _is_forbidden_official_source(value: str | None) -> bool:
    if not value:
        return False
    lower = value.strip().lower()
    if lower in {"tbd", "dnp"}:
        return False
    if lower in _FORBIDDEN_OFFICIAL_SOURCE_VALUES:
        return True
    return any(phrase in lower for phrase in _FORBIDDEN_CUSTOMER_HEADER_PHRASES)


def _extract_explicit_official_source(line: BomLine) -> str | None:
    """Return canonical official source name only when explicitly present in notes."""
    text = (line.notes or "").strip()
    if not text:
        return None
    lower = text.lower()
    for needle, label in _OFFICIAL_SOURCE_PATTERNS:
        if needle in lower:
            return label
    # Exact match on notes when user entered a canonical source name directly.
    for _needle, label in _OFFICIAL_SOURCE_PATTERNS:
        if lower == label.lower():
            return label
    return None


def _resolve_official_row(line: BomLine) -> tuple[str, float | None]:
    """Resolve official source + unit price. No generic fallbacks; no price without source."""
    explicit = _extract_explicit_official_source(line)
    if explicit is None or _is_forbidden_official_source(explicit):
        return "TBD", None
    if line.customer_price is not None:
        return explicit, float(line.customer_price)
    return explicit, None


def _validate_official_source_values(values: list[str]) -> None:
    for value in values:
        if _is_forbidden_official_source(value):
            raise ValueError(
                f"Unsafe official source value '{value}' in customer export output"
            )


def _apply_data_row_number_formats(ws, row: int, *, is_dnp: bool) -> None:
    ws.cell(row=row, column=_COL_QTY).number_format = QTY_INT_FMT
    ws.cell(row=row, column=_COL_REQ_QTY).number_format = QTY_INT_FMT
    if not is_dnp:
        ws.cell(row=row, column=_COL_OFFICIAL_UNIT).number_format = USD_UNIT_FMT
    ws.cell(row=row, column=_COL_OFFICIAL_EXTENDED).number_format = USD_CURRENCY_FMT


def build_customer_bom_review_xlsx(
    db: Session,
    *,
    project: Project,
    version: BomVersion,
    lines: list[BomLine],
) -> tuple[bytes, str]:
    # Official/market reference export only — not final customer quote pricing.

    customer = db.get(Customer, project.customer_id)
    version_label = version.version_name or version.version_label
    file_name = customer_bom_review_filename(project.code, version_label)
    export_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    build_qty = version.build_quantity or project.build_quantity or 0

    wb, ws = _load_customer_template_sheet()
    template_extended_formula = _snapshot_template_extended_formula(ws)

    template_headers = [
        ws.cell(row=TEMPLATE_TABLE_HEADER_ROW, column=c).value
        for c in range(1, TEMPLATE_TABLE_COLS + 1)
    ]
    _validate_customer_export_headers([str(h) for h in template_headers if h])

    style_sources = _snapshot_row_styles(ws, TEMPLATE_DATA_START_ROW)

    _fill_customer_template_metadata(
        ws,
        customer_name=customer.name if customer else "—",
        project_name=project.name,
        project_code=project.code,
        version_label=version_label,
        revision=version.revision_code or "—",
        doc_number=version.source_doc_number or "—",
        board_name=version.board_name or "—",
        build_qty=build_qty,
        export_date=export_date,
    )

    last_data_row = TEMPLATE_DATA_START_ROW + len(lines) - 1 if lines else TEMPLATE_DATA_START_ROW
    data_end_row = max(last_data_row, TEMPLATE_DATA_DEFAULT_END_ROW)

    if last_data_row > TEMPLATE_DATA_DEFAULT_END_ROW:
        extra = last_data_row - TEMPLATE_DATA_DEFAULT_END_ROW
        ws.insert_rows(TEMPLATE_DATA_DEFAULT_END_ROW + 1, extra)
        data_end_row = last_data_row
        for offset in range(extra):
            new_row = TEMPLATE_DATA_DEFAULT_END_ROW + 1 + offset
            _apply_row_styles(ws, new_row, style_sources)
            if template_extended_formula:
                _apply_template_extended_formula(ws, new_row, template_extended_formula)

    _clear_bom_row_values(ws, TEMPLATE_DATA_START_ROW, data_end_row)

    written_sources: list[str] = []

    for row_offset, ln in enumerate(lines):
        row = TEMPLATE_DATA_START_ROW + row_offset
        is_dnp = _is_dnp_line(ln)

        if is_dnp:
            _apply_dnp_row_styles(ws, row, style_sources)
            official_source = "DNP"
            unit_price = None
            notes = _DNP_NOTE
        else:
            _apply_row_styles(ws, row, style_sources)
            official_source, unit_price = _resolve_official_row(ln)
            notes = ln.notes

        written_sources.append(official_source)

        ws.cell(row=row, column=_COL_LINE, value=ln.line_no)
        ws.cell(row=row, column=_COL_MPN, value=ln.mpn)
        ws.cell(row=row, column=_COL_MANUFACTURER, value=ln.manufacturer)
        ws.cell(row=row, column=_COL_DESCRIPTION, value=ln.description)
        ws.cell(row=row, column=_COL_QTY, value=_num(ln.quantity))
        ws.cell(row=row, column=_COL_REQ_QTY, value=_num(ln.required_qty))
        ws.cell(row=row, column=_COL_REFDES, value=ln.reference_designators)
        ws.cell(row=row, column=_COL_FOOTPRINT, value=ln.footprint)
        ws.cell(row=row, column=_COL_OFFICIAL_SOURCE, value=official_source)
        ws.cell(row=row, column=_COL_OFFICIAL_UNIT, value=None if is_dnp else unit_price)
        ws.cell(row=row, column=_COL_NOTES, value=notes)

        ext_cell = ws.cell(row=row, column=_COL_OFFICIAL_EXTENDED)
        if is_dnp:
            ext_cell.value = 0
        elif not _cell_has_formula(ext_cell) and template_extended_formula:
            _apply_template_extended_formula(ws, row, template_extended_formula)

        _apply_data_row_number_formats(ws, row, is_dnp=is_dnp)

    _validate_official_source_values(written_sources)

    last_col = get_column_letter(TEMPLATE_TABLE_COLS)
    ws.auto_filter.ref = (
        f"A{TEMPLATE_TABLE_HEADER_ROW}:{last_col}{max(data_end_row, TEMPLATE_TABLE_HEADER_ROW)}"
    )
    if ws.freeze_panes is None:
        ws.freeze_panes = ws.cell(row=TEMPLATE_DATA_START_ROW, column=1)

    _validate_customer_export_headers(
        [
            str(ws.cell(row=TEMPLATE_TABLE_HEADER_ROW, column=c).value or "")
            for c in range(1, TEMPLATE_TABLE_COLS + 1)
        ]
    )

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue(), file_name


def build_internal_bom_quality_xlsx(
    db: Session,
    *,
    project: Project,
    version: BomVersion,
    lines: list[BomLine],
) -> tuple[bytes, str]:
    version_label = version.version_name or version.version_label
    file_name = internal_bom_quality_filename(project.code, version_label)

    wb = Workbook()
    ws = wb.active
    ws.title = "Internal BOM Quality"
    ws.sheet_view.rightToLeft = True

    _write_header_block(
        ws,
        [
            ("Project", project.name),
            ("Project Code", project.code),
            ("BOM Version", version_label),
            ("INTERNAL ONLY", "Not for customer distribution"),
        ],
    )

    headers = [
        "Line",
        "Status",
        "MPN",
        "Manufacturer",
        "Description",
        "Qty",
        "Required Qty",
        "RefDes",
        "Footprint",
        "DNP",
        "Needs Review",
        "Review Reason",
        "Quality Status",
    ]
    ws.append(headers)
    for cell in ws[ws.max_row]:
        cell.font = Font(bold=True)

    for ln in lines:
        ws.append(
            [
                ln.line_no,
                ln.quality_status,
                ln.mpn,
                ln.manufacturer,
                ln.description,
                _num(ln.quantity),
                _num(ln.required_qty),
                ln.reference_designators,
                ln.footprint,
                "Yes" if ln.dnp else "No",
                "Yes" if ln.needs_review else "No",
                ln.review_reason,
                ln.quality_status,
            ]
        )

    _autosize(ws)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue(), file_name


def build_internal_pricing_snapshot_xlsx(
    db: Session,
    *,
    project: Project,
    snapshot: PricingSnapshot,
) -> tuple[bytes, str]:
    snap_name = snapshot.snapshot_name or snapshot.name
    file_name = internal_pricing_snapshot_filename(project.code, snap_name)

    p_lines = list(
        db.scalars(
            select(PricingLine)
            .where(PricingLine.pricing_snapshot_id == snapshot.id)
            .order_by(PricingLine.id)
        )
    )
    bom_by_id: dict[int, BomLine] = {}
    bom_ids = [pl.bom_line_id for pl in p_lines if pl.bom_line_id is not None]
    if bom_ids:
        for bl in db.scalars(select(BomLine).where(BomLine.id.in_(bom_ids))):
            bom_by_id[bl.id] = bl

    wb = Workbook()
    ws = wb.active
    ws.title = "Internal Pricing"
    ws.sheet_view.rightToLeft = True

    _write_header_block(
        ws,
        [
            ("Project", project.name),
            ("Project Code", project.code),
            ("Pricing Snapshot", snap_name),
            ("Currency", snapshot.currency),
            ("INTERNAL ONLY", "Not for customer distribution"),
        ],
    )

    headers = [
        "Line",
        "MPN",
        "Manufacturer",
        "Description",
        "Required Qty",
        "Unit Cost",
        "Extended Cost",
        "Currency",
        "Pricing Status",
        "Match Confidence",
        "Selected Source",
        "Notes",
    ]
    ws.append(headers)
    for cell in ws[ws.max_row]:
        cell.font = Font(bold=True)

    for idx, pl in enumerate(p_lines, start=1):
        bl = bom_by_id.get(pl.bom_line_id) if pl.bom_line_id else None
        ws.append(
            [
                bl.line_no if bl else idx,
                pl.mpn or (bl.mpn if bl else None),
                bl.manufacturer if bl else None,
                bl.description if bl else None,
                _num(pl.required_qty),
                _num(pl.unit_cost),
                _num(pl.extended_cost),
                pl.currency or snapshot.currency,
                pl.pricing_status,
                pl.match_confidence,
                pl.selected_source,
                pl.notes,
            ]
        )

    _autosize(ws)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue(), file_name
