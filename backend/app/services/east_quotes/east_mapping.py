"""East supplier quote column hints and suggested mapping."""

from __future__ import annotations

from app.services.bom_parser import suggest_mapping_generic

EAST_FIELDS = [
    "mpn",
    "unit_price",
    "designator",
    "quantity",
    "manufacturer",
    "description",
    "vendor",
    "supplier_part_number",
    "total_price",
    "quoted_qty",
    "lead_time",
    "assembly",
    "footprint",
    "value",
    "brand",
    "comments",
]

EAST_FIELD_HINTS: dict[str, list[str]] = {
    "mpn": [
        "manufacturer part number 1",
        "manufacturer part number",
        "manufacturer part no",
        "mpn",
        "part number",
        "part no",
        "p/n",
    ],
    "unit_price": [
        "unit price usd",
        "unit price",
        "unit cost",
        "price",
        "מחיר יחידה",
    ],
    "designator": ["designator", "refdes", "reference", "ref"],
    "quantity": ["quantity", "qty per", "qty per assembly", "bom qty"],
    "manufacturer": ["manufacturer 1", "manufacturer", "mfr", "mfg"],
    "description": ["description", "part description", "desc", "תיאור"],
    "vendor": ["vendor", "supplier", "supplier name", "vendor name", "ספק"],
    "supplier_part_number": [
        "supplier part number 1",
        "supplier part number",
        "supplier p/n",
        "supplier pn",
    ],
    "total_price": ["total in usd", "total price", "total", "extended price"],
    "quoted_qty": ["quoted qty", "quote qty", "order qty"],
    "lead_time": ["l/t", "lead time", "leadtime", "lt"],
    "assembly": ["assembly", "populate", "dnp"],
    "footprint": ["footprint", "package", "case"],
    "value": ["value"],
    "brand": ["brand"],
    "comments": ["comments", "comment", "remarks", "notes"],
}


def suggest_east_mapping(columns: list[str]) -> dict[str, str | None]:
    mapping = suggest_mapping_generic(columns, EAST_FIELD_HINTS)
    return {f: mapping.get(f) for f in EAST_FIELDS}
