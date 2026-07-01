"""Resolve display description for BOM/pricing lines across modules."""

from __future__ import annotations

from app.models import BomLine, OfficialSupplierPriceResult
from app.services.suppliers.base import (
    OFFICIAL_API_SUPPLIERS,
    SUPPLIER_DIGIKEY,
    SUPPLIER_MOUSER,
)
from app.services.suppliers.pricing_store import DEFAULT_SUPPLIER_PRIORITY

_INVALID_DESC_STATUSES = frozenset({"not_found", "error", "not_fetched"})


def _clean(text: str | None) -> str | None:
    if text is None:
        return None
    stripped = text.strip()
    return stripped or None


def description_from_price_result(row: OfficialSupplierPriceResult | None) -> str | None:
    if row is None:
        return None
    text = _clean(row.description)
    if not text:
        return None
    if row.match_status in _INVALID_DESC_STATUSES:
        return None
    return text


def description_from_east_offers(east_offers: list[dict]) -> str | None:
    for offer in east_offers:
        text = _clean(offer.get("description"))
        if text:
            return text
    return None


def _result_for_supplier(
    results_map: dict,
    bom_line_id: int,
    supplier: str,
) -> OfficialSupplierPriceResult | None:
    return results_map.get((bom_line_id, supplier))


def resolve_line_display_description(
    bl: BomLine,
    *,
    line_id: int,
    results_map: dict,
    east_offers: list[dict],
    priority: list[str] | None = None,
) -> str | None:
    """
    Priority:
    1. Digi-Key / Mouser API description (override Chinese when they differ)
    2. Other official API suppliers (e.g. TI)
    3. Original BOM upload description
    4. East / China quote description
    """
    priority = priority or list(DEFAULT_SUPPLIER_PRIORITY)

    for supplier in (SUPPLIER_DIGIKEY, SUPPLIER_MOUSER):
        desc = description_from_price_result(_result_for_supplier(results_map, line_id, supplier))
        if desc:
            return desc

    for supplier in priority:
        if supplier in (SUPPLIER_DIGIKEY, SUPPLIER_MOUSER):
            continue
        if supplier not in OFFICIAL_API_SUPPLIERS:
            continue
        desc = description_from_price_result(_result_for_supplier(results_map, line_id, supplier))
        if desc:
            return desc

    bom_desc = _clean(bl.description)
    if bom_desc:
        return bom_desc

    return description_from_east_offers(east_offers)
