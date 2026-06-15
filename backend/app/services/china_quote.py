"""China supplier-quote column hints + suggested mapping."""

from __future__ import annotations

from app.services.bom_parser import suggest_mapping_generic

# Canonical China-quote fields.
CHINA_FIELDS = [
    "quoted_mpn",
    "manufacturer",
    "description",
    "supplier_part_number",
    "unit_price",
    "currency",
    "moq",
    "available_qty",
    "lead_time",
    "notes",
]

CHINA_FIELD_HINTS: dict[str, list[str]] = {
    "quoted_mpn": [
        "manufacturer part number",
        "mpn",
        "part number",
        "part no",
        "p/n",
        "pn",
    ],
    "manufacturer": ["manufacturer", "mfr", "mfg", "brand"],
    "description": ["part description", "description", "desc"],
    "supplier_part_number": [
        "supplier part number",
        "supplier p/n",
        "supplier pn",
        "supplier no",
    ],
    "unit_price": ["unit price", "unit cost", "price"],
    "currency": ["currency", "ccy"],
    "moq": ["moq", "min qty", "minimum order", "min order"],
    "available_qty": ["available qty", "available", "stock", "inventory", "on hand"],
    "lead_time": ["lead time", "leadtime", "lt"],
    "notes": ["notes", "remark", "remarks", "comment", "comments"],
}


def suggest_china_mapping(columns: list[str]) -> dict[str, str | None]:
    mapping = suggest_mapping_generic(columns, CHINA_FIELD_HINTS)
    return {f: mapping.get(f) for f in CHINA_FIELDS}
