"""Parse uploaded BOM tables (Excel .xlsx/.xls or CSV).

Customer BOM files frequently contain metadata rows (Board Name, Doc. Number,
Revised Date, blank rows) before the real header row, so we never assume row 0
is the header — we scan the first rows and score candidate header rows.
"""

from __future__ import annotations

import csv
import io
import re

from openpyxl import load_workbook

# Canonical BOM line fields the importer can map columns onto. Order matters for
# UI display only; mapping itself is conflict-aware (see ``suggest_mapping``).
BOM_FIELDS: list[str] = [
    "mpn",
    "manufacturer",
    "description",
    "quantity",
    "reference_designators",
    "footprint",
    "value",
    "supplier_part_number",
    "unit",
    "customer_price",
    "internal_cost",
    "is_critical",
    "dnp",
]

# Keywords that indicate a row is a real BOM header row.
HEADER_KEYWORDS: list[str] = [
    "quantity",
    "qty",
    "designator",
    "refdes",
    "reference",
    "part number",
    "part no",
    "manufacturer part number",
    "mpn",
    "manufacturer",
    "description",
    "value",
    "footprint",
    "package",
    "supplier part number",
    "datasheet",
    "assembly",
    "dnp",
    "comment",
    "p/n",
]

# Per-field hints (longer / more specific hints win during assignment).
FIELD_HINTS: dict[str, list[str]] = {
    "mpn": [
        "manufacturer part number",
        "mfr part number",
        "mfg part number",
        "mpn",
        "part number",
        "part no",
        "p/n",
        "pn",
        'מק"ט',
        "מקט",
    ],
    "manufacturer": ["manufacturer", "mfr", "mfg", "maker", "brand", "יצרן"],
    "description": ["part description", "description", "comment", "desc", "details", "תיאור"],
    "quantity": ["quantity", "qty", "amount", "כמות"],
    "reference_designators": [
        "reference designator",
        "designator",
        "refdes",
        "references",
        "reference",
        "ref des",
    ],
    "footprint": ["pcb footprint", "footprint", "package", "pkg"],
    "value": ["value", "ערך"],
    "supplier_part_number": [
        "supplier part number",
        "supplier p/n",
        "supplier pn",
        "digi-key pn",
        "digikey pn",
        "digi-key part number",
        "mouser pn",
        "mouser part number",
    ],
    "unit": ["unit", "uom", "יחידה"],
    "customer_price": ["customer price", "sell price", "price", "מחיר ללקוח", "מחיר"],
    "internal_cost": ["internal cost", "unit cost", "cost", "עלות"],
    "is_critical": ["critical", "קריטי"],
    "dnp": ["dnp", "dni", "do not populate", "do not place", "assembly", "fitted", "populate", "mount"],
}

SCAN_ROWS = 30


def normalize_key(name: str) -> str:
    """Lowercase, strip, drop line breaks, collapse whitespace — for matching."""
    s = (name or "").replace("\n", " ").replace("\r", " ").strip().lower()
    return re.sub(r"\s+", " ", s)


def clean_display(name: str) -> str:
    """Trim + collapse whitespace but keep the original casing for display."""
    s = (name or "").replace("\n", " ").replace("\r", " ").strip()
    return re.sub(r"\s+", " ", s)


def _stringify(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def list_sheets_and_rows(
    content: bytes, filename: str, sheet_name: str | None = None
) -> tuple[list[str], str, list[list[str]]]:
    """Return (sheet_names, active_sheet_name, rows) for the chosen sheet."""
    name = (filename or "").lower()
    if name.endswith(".csv"):
        text = content.decode("utf-8-sig", errors="replace")
        rows = [[_stringify(c) for c in r] for r in csv.reader(io.StringIO(text))]
        return ["CSV"], "CSV", rows

    wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    sheet_names = list(wb.sheetnames)
    ws = wb[sheet_name] if sheet_name in sheet_names else wb.active
    rows = [[_stringify(c) for c in raw] for raw in ws.iter_rows(values_only=True)]
    wb.close()
    return sheet_names, ws.title, rows


def _keyword_hits(row: list[str]) -> int:
    norm_cells = [normalize_key(c) for c in row if c.strip()]
    return sum(1 for c in norm_cells if any(kw in c for kw in HEADER_KEYWORDS))


def detect_header_row(rows: list[list[str]]) -> tuple[int | None, list[dict]]:
    """Scan the first rows and return (detected_index, candidate_rows).

    A candidate header row has >= 3 non-empty cells. The detected row is the
    candidate with the most BOM-keyword hits (requires >= 2 to be considered a
    real header), tie-broken by more non-empty cells then earliest row.
    """
    candidates: list[dict] = []
    for i, row in enumerate(rows[:SCAN_ROWS]):
        non_empty = [c for c in row if c.strip()]
        if len(non_empty) < 3:
            continue
        candidates.append(
            {
                "row_index": i,
                "values": [clean_display(c) for c in row],
                "non_empty_count": len(non_empty),
                "keyword_hits": _keyword_hits(row),
            }
        )

    detected: int | None = None
    best: dict | None = None
    for c in candidates:
        if c["keyword_hits"] < 2:
            continue
        if (
            best is None
            or c["keyword_hits"] > best["keyword_hits"]
            or (
                c["keyword_hits"] == best["keyword_hits"]
                and c["non_empty_count"] > best["non_empty_count"]
            )
        ):
            best = c
    if best is not None:
        detected = best["row_index"]
    return detected, candidates


def _best_hint_score(col_norm: str, hints: list[str]) -> int:
    best = 0
    for hint in hints:
        hn = normalize_key(hint)
        if hn and hn in col_norm:
            score = len(hn) * (3 if col_norm == hn else 1)
            best = max(best, score)
    return best


def suggest_mapping(columns: list[str]) -> dict[str, str | None]:
    """Conflict-aware auto mapping of columns to BOM fields.

    Builds (score, field, column) candidates and greedily assigns the highest
    scoring pairs so that, e.g., "Manufacturer Part Number" beats "Manufacturer"
    for MPN, and "Supplier Part Number" is claimed by supplier_part_number
    rather than MPN. If no MPN column exists, supplier PN is used as a fallback.
    """
    cols = [(c, normalize_key(c)) for c in columns if c.strip()]
    pairs: list[tuple[int, str, str]] = []
    for field, hints in FIELD_HINTS.items():
        for disp, cn in cols:
            score = _best_hint_score(cn, hints)
            if score > 0:
                pairs.append((score, field, disp))
    pairs.sort(key=lambda x: -x[0])

    assigned_field: dict[str, str] = {}
    used_cols: set[str] = set()
    for _, field, disp in pairs:
        if field in assigned_field or disp in used_cols:
            continue
        assigned_field[field] = disp
        used_cols.add(disp)

    mapping: dict[str, str | None] = {f: assigned_field.get(f) for f in BOM_FIELDS}
    if mapping.get("mpn") is None and mapping.get("supplier_part_number"):
        mapping["mpn"] = mapping["supplier_part_number"]
    return mapping
