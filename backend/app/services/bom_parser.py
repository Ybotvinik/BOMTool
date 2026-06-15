"""Parse uploaded BOM tables (Excel .xlsx/.xls or CSV) into headers + rows."""

from __future__ import annotations

import csv
import io

from openpyxl import load_workbook

# Canonical BOM line fields the importer can map columns onto.
BOM_FIELDS: list[str] = [
    "mpn",
    "manufacturer",
    "description",
    "quantity",
    "reference_designators",
    "unit",
    "customer_price",
    "internal_cost",
    "is_critical",
]

# Keyword hints used to auto-suggest a column for each field.
_FIELD_HINTS: dict[str, list[str]] = {
    "mpn": ["mpn", "part number", "part no", "p/n", "pn", "manufacturer part", "מק\"ט", "מקט"],
    "manufacturer": ["manufacturer", "mfg", "mfr", "brand", "maker", "יצרן"],
    "description": ["description", "desc", "details", "תיאור"],
    "quantity": ["qty", "quantity", "amount", "כמות"],
    "reference_designators": ["ref", "reference", "designator", "refdes"],
    "unit": ["unit", "uom", "יחידה"],
    "customer_price": ["customer price", "sell price", "price", "מחיר ללקוח", "מחיר"],
    "internal_cost": ["internal cost", "unit cost", "cost", "עלות"],
    "is_critical": ["critical", "קריטי"],
}


def _stringify(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def parse_table(content: bytes, filename: str) -> tuple[list[str], list[list[str]]]:
    """Return (headers, rows) from an uploaded file. Rows are lists of strings."""
    name = filename.lower()
    if name.endswith(".csv"):
        return _parse_csv(content)
    return _parse_xlsx(content)


def _parse_csv(content: bytes) -> tuple[list[str], list[list[str]]]:
    text = content.decode("utf-8-sig", errors="replace")
    reader = list(csv.reader(io.StringIO(text)))
    if not reader:
        return [], []
    headers = [_stringify(c) for c in reader[0]]
    rows = [[_stringify(c) for c in r] for r in reader[1:] if any(_stringify(c) for c in r)]
    return headers, rows


def _parse_xlsx(content: bytes) -> tuple[list[str], list[list[str]]]:
    wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active
    rows_iter = ws.iter_rows(values_only=True)
    try:
        header_row = next(rows_iter)
    except StopIteration:
        return [], []
    headers = [_stringify(c) for c in header_row]
    rows: list[list[str]] = []
    for raw in rows_iter:
        cells = [_stringify(c) for c in raw]
        if any(cells):
            # Pad/truncate to header width.
            cells = (cells + [""] * len(headers))[: len(headers)]
            rows.append(cells)
    wb.close()
    return headers, rows


def suggest_mapping(headers: list[str]) -> dict[str, str | None]:
    """Best-effort guess of which column maps to each BOM field."""
    lowered = {h.lower(): h for h in headers if h}
    mapping: dict[str, str | None] = {}
    for field, hints in _FIELD_HINTS.items():
        match: str | None = None
        for hint in hints:
            for low, original in lowered.items():
                if hint in low:
                    match = original
                    break
            if match:
                break
        mapping[field] = match
    return mapping
