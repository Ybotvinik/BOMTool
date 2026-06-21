"""Normalized supplier API result and shared helpers."""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any


SUPPLIER_DIGIKEY = "digikey"
SUPPLIER_MOUSER = "mouser"
SUPPLIER_TI = "ti"
SUPPLIER_LINK = "link"

OFFICIAL_API_SUPPLIERS = frozenset({SUPPLIER_DIGIKEY, SUPPLIER_MOUSER, SUPPLIER_TI})

SUPPLIER_DISPLAY_NAMES: dict[str, str] = {
    SUPPLIER_DIGIKEY: "Digi-Key",
    SUPPLIER_MOUSER: "Mouser",
    SUPPLIER_TI: "TI",
    SUPPLIER_LINK: "Link",
}

SOURCE_TYPE_EAST = "east_quote"
INTERNAL_SUPPLIERS = frozenset({SUPPLIER_LINK})


class SupplierApiError(Exception):
    """Raised when supplier API call fails or credentials are missing."""

    def __init__(self, message: str, *, supplier: str | None = None):
        super().__init__(message)
        self.supplier = supplier
        self.message = message


@dataclass
class SupplierPriceResult:
    supplier: str
    mpn: str
    manufacturer: str | None = None
    matched_mpn: str | None = None
    supplier_part_number: str | None = None
    product_url: str | None = None
    description: str | None = None
    currency: str = "USD"
    unit_price_for_required_qty: float | None = None
    price_break_qty: float | None = None
    available_qty: float | None = None
    lead_time: str | None = None
    lifecycle_status: str | None = None
    is_exact_match: bool = False
    match_status: str = "not_found"
    match_reason: str | None = None
    raw_response: dict[str, Any] | None = field(default=None, repr=False)


def select_price_break(
    breaks: list[tuple[float, float]], required_qty: float
) -> tuple[float | None, float | None]:
    """Pick unit price for required quantity from (break_qty, unit_price) pairs."""
    if not breaks:
        return None, None
    sorted_breaks = sorted(breaks, key=lambda x: x[0])
    qty_for_breaks = required_qty if required_qty > 0 else sorted_breaks[-1][0]
    chosen_qty = sorted_breaks[0][0]
    chosen_price = sorted_breaks[0][1]
    for break_qty, unit_price in sorted_breaks:
        if break_qty <= qty_for_breaks:
            chosen_qty = break_qty
            chosen_price = unit_price
        else:
            break
    return float(chosen_price), float(chosen_qty)


def normalize_mpn(mpn: str | None) -> str:
    if not mpn:
        return ""
    return mpn.strip().upper()


def mpn_exact_match(searched: str, returned: str | None) -> bool:
    if not returned:
        return False
    return normalize_mpn(searched) == normalize_mpn(returned)


def decimal_or_none(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(Decimal(str(value)))
    except Exception:
        return None


def parse_money(value: Any) -> float | None:
    """Parse currency strings like '$0.1234' or '0.1234'."""
    if value is None:
        return None
    text = str(value).strip().replace("$", "").replace(",", "")
    if not text:
        return None
    try:
        return float(Decimal(text))
    except Exception:
        return None


def supplier_result_to_dict(result: SupplierPriceResult, *, is_mock: bool = False) -> dict:
    return {
        "supplier": result.supplier,
        "mpn": result.mpn,
        "matched_mpn": result.matched_mpn,
        "manufacturer": result.manufacturer,
        "description": result.description,
        "supplier_part_number": result.supplier_part_number,
        "product_url": result.product_url,
        "currency": result.currency,
        "unit_price_for_required_qty": result.unit_price_for_required_qty,
        "price_break_qty": result.price_break_qty,
        "available_qty": result.available_qty,
        "lead_time": result.lead_time,
        "lifecycle_status": result.lifecycle_status,
        "match_status": result.match_status,
        "match_reason": result.match_reason,
        "is_exact_match": result.is_exact_match,
        "mock": is_mock,
    }
