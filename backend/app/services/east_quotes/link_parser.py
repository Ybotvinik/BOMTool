"""Parser for Link / East supplier quote XLSX files."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime

from app.services.bom_parser import clean_display, list_sheets_and_rows
from app.services.suppliers.base import parse_money

FOOTER_LABELS = frozenset({"total price", "unit price", "subtotal", "grand total"})
HEADER_MARKERS = frozenset(
    {
        "quantity",
        "designator",
        "manufacturer part number 1",
        "unit price usd",
    }
)


@dataclass
class ParsedEastQuoteLine:
    row_number: int
    quantity: float | None = None
    designator: str | None = None
    mpn: str | None = None
    description: str | None = None
    footprint: str | None = None
    value: str | None = None
    manufacturer: str | None = None
    supplier_part_number: str | None = None
    assembly: str | None = None
    vendor: str | None = None
    quoted_qty: float | None = None
    unit_price: float | None = None
    total_price: float | None = None
    currency: str = "USD"
    lead_time: str | None = None
    brand: str | None = None
    supplier_code: str | None = None
    comments: str | None = None
    is_dnp: bool = False


@dataclass
class ParsedEastQuote:
    sheet_name: str
    board_name: str | None = None
    doc_number: str | None = None
    revised_date: str | None = None
    total_price_summary: float | None = None
    unit_price_summary: float | None = None
    header_row_index: int | None = None
    lines: list[ParsedEastQuoteLine] = field(default_factory=list)


def _cell(row: list[str], idx: int) -> str:
    if idx < 0 or idx >= len(row):
        return ""
    return clean_display(row[idx])


def _is_footer_row(row: list[str]) -> bool:
    if not any(c.strip() for c in row):
        return True
    first = (row[0] or "").strip().lower()
    return first in FOOTER_LABELS


def _find_header_row(rows: list[list[str]]) -> int | None:
    for idx, row in enumerate(rows[:30]):
        labels = {c.strip().lower() for c in row if c and c.strip()}
        hits = sum(1 for m in HEADER_MARKERS if m in labels or any(m in x for x in labels))
        if hits >= 3:
            return idx
    return None


def _extract_metadata(rows: list[list[str]], header_idx: int) -> dict[str, str | None]:
    meta: dict[str, str | None] = {
        "board_name": None,
        "doc_number": None,
        "revised_date": None,
    }
    for row in rows[:header_idx]:
        if len(row) < 2:
            continue
        label = (row[0] or "").strip().lower().rstrip(":")
        value = clean_display(row[1]) if len(row) > 1 else ""
        if not value:
            continue
        if "board" in label:
            meta["board_name"] = value
        elif "doc" in label and "number" in label:
            meta["doc_number"] = value
        elif "revised" in label or "date" in label:
            meta["revised_date"] = value
    return meta


def _column_map(header: list[str]) -> dict[str, int]:
    mapping: dict[str, int] = {}
    for idx, col in enumerate(header):
        key = col.strip().lower()
        if not key:
            continue
        mapping[key] = idx
    return mapping


def _col_idx(cols: dict[str, int], *names: str) -> int | None:
    for name in names:
        if name in cols:
            return cols[name]
    for name in names:
        if len(name) < 10:
            continue
        for k, v in cols.items():
            if name in k:
                return v
    return None


def _parse_qty(text: str) -> float | None:
    text = (text or "").strip().replace(",", "")
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def parse_link_xlsx(content: bytes, filename: str, sheet_name: str | None = None) -> ParsedEastQuote:
    """Parse a Link-format East supplier quote workbook."""
    sheet_names, active_sheet, rows = list_sheets_and_rows(content, filename, sheet_name)
    header_idx = _find_header_row(rows)
    if header_idx is None:
        raise ValueError("לא נמצאה שורת כותרות (Quantity / Designator / MPN / Unit Price USD)")

    meta = _extract_metadata(rows, header_idx)
    header = [clean_display(c) for c in rows[header_idx]]
    cols = _column_map(header)

    idx_qty = _col_idx(cols, "quantity", "qty")
    idx_des = _col_idx(cols, "designator", "refdes")
    idx_mpn = _col_idx(cols, "manufacturer part number 1", "manufacturer part number", "mpn")
    idx_desc = _col_idx(cols, "description")
    idx_fp = _col_idx(cols, "footprint", "package")
    idx_val = _col_idx(cols, "value")
    idx_mfr = _col_idx(cols, "manufacturer 1", "manufacturer")
    idx_spn = _col_idx(cols, "supplier part number 1", "supplier part number")
    idx_asm = _col_idx(cols, "assembly")
    idx_vendor = _col_idx(cols, "vendor")
    idx_qqty = cols.get("qty") or cols.get("quoted qty")
    idx_unit = _col_idx(cols, "unit price usd", "unit price")
    idx_total = _col_idx(cols, "total in usd", "total price", "total")
    idx_lt = _col_idx(cols, "l/t", "lead time", "lt")
    idx_brand = _col_idx(cols, "brand")
    idx_code = _col_idx(cols, "code")
    idx_comments = _col_idx(cols, "comments", "comment")

    parsed = ParsedEastQuote(
        sheet_name=active_sheet,
        board_name=meta["board_name"],
        doc_number=meta["doc_number"],
        revised_date=meta["revised_date"],
        header_row_index=header_idx,
    )

    line_no = 0
    for offset, row in enumerate(rows[header_idx + 1 :], start=header_idx + 2):
        if not any(c.strip() for c in row):
            continue
        if _is_footer_row(row):
            label = (row[0] or "").strip().lower()
            if "total price" in label and idx_total is not None:
                parsed.total_price_summary = parse_money(_cell(row, idx_total))
            elif "unit price" in label and idx_unit is not None:
                parsed.unit_price_summary = parse_money(_cell(row, idx_unit))
            continue

        assembly = _cell(row, idx_asm) if idx_asm is not None else ""
        is_dnp = assembly.upper() == "DNP"
        mpn = _cell(row, idx_mpn) if idx_mpn is not None else ""
        if not mpn and not is_dnp and not _cell(row, idx_des if idx_des is not None else -1):
            continue

        line_no += 1
        parsed.lines.append(
            ParsedEastQuoteLine(
                row_number=offset,
                quantity=_parse_qty(_cell(row, idx_qty)) if idx_qty is not None else None,
                designator=_cell(row, idx_des) if idx_des is not None else None,
                mpn=mpn or None,
                description=_cell(row, idx_desc) if idx_desc is not None else None,
                footprint=_cell(row, idx_fp) if idx_fp is not None else None,
                value=_cell(row, idx_val) if idx_val is not None else None,
                manufacturer=_cell(row, idx_mfr) if idx_mfr is not None else None,
                supplier_part_number=_cell(row, idx_spn) if idx_spn is not None else None,
                assembly=assembly or None,
                vendor=_cell(row, idx_vendor) if idx_vendor is not None else None,
                quoted_qty=_parse_qty(_cell(row, idx_qqty)) if idx_qqty is not None else None,
                unit_price=parse_money(_cell(row, idx_unit)) if idx_unit is not None else None,
                total_price=parse_money(_cell(row, idx_total)) if idx_total is not None else None,
                lead_time=_cell(row, idx_lt) if idx_lt is not None else None,
                brand=_cell(row, idx_brand) if idx_brand is not None else None,
                supplier_code=_cell(row, idx_code) if idx_code is not None else None,
                comments=_cell(row, idx_comments) if idx_comments is not None else None,
                is_dnp=is_dnp,
            )
        )

    return parsed
