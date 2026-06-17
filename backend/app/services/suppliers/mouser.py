"""Mouser Search API client (Search API only — not Order API)."""

from __future__ import annotations

import logging
import re
import time
from typing import Any

import httpx

from app.config import Settings
from app.services.suppliers.base import (
    SUPPLIER_MOUSER,
    SupplierApiError,
    SupplierPriceResult,
    decimal_or_none,
    mpn_exact_match,
    normalize_mpn,
    parse_money,
    select_price_break,
)

logger = logging.getLogger(__name__)

MOUSER_API_BASE = "https://api.mouser.com/api/v1"


def _redact_api_key(text: str) -> str:
    return re.sub(r"apiKey=[^&\s\"']+", "apiKey=***", text, flags=re.IGNORECASE)


def _mouser_errors(data: dict) -> list[str]:
    errors = data.get("Errors") or []
    if not isinstance(errors, list):
        return []
    return [
        str(e.get("Message") or e.get("Code") or e)
        for e in errors
        if isinstance(e, dict)
    ]


def _price_breaks_from_part(part: dict) -> list[tuple[float, float]]:
    breaks: list[tuple[float, float]] = []
    for pb in part.get("PriceBreaks") or []:
        if not isinstance(pb, dict):
            continue
        qty = decimal_or_none(pb.get("Quantity"))
        price = parse_money(pb.get("Price"))
        if qty is not None and price is not None:
            breaks.append((qty, price))
    return breaks


def _stock_from_part(part: dict) -> float | None:
    qty_available = decimal_or_none(part.get("AvailabilityInStock"))
    if qty_available is not None:
        return qty_available
    avail_text = part.get("Availability") or ""
    digits = "".join(ch for ch in str(avail_text) if ch.isdigit())
    return decimal_or_none(digits) if digits else None


def _part_sort_key(part: dict, *, searched: str, required_qty: float) -> tuple:
    exact = mpn_exact_match(searched, part.get("ManufacturerPartNumber"))
    stock = _stock_from_part(part) or 0
    breaks = _price_breaks_from_part(part)
    unit_price, _ = select_price_break(breaks, required_qty or 1)
    price = unit_price if unit_price is not None else 999999.0
    return (0 if exact else 1, 0 if stock > 0 else 1, price)


def _pick_best_part(parts: list[dict], *, searched: str, required_qty: float) -> dict:
    return min(parts, key=lambda p: _part_sort_key(p, searched=searched, required_qty=required_qty))


def _parse_mouser_part(
    part: dict, *, searched: str, mpn: str, required_qty: float, raw: dict
) -> SupplierPriceResult:
    mfr_mpn = part.get("ManufacturerPartNumber")
    if isinstance(mfr_mpn, str):
        mfr_mpn = mfr_mpn.strip() or None
    exact = mpn_exact_match(searched, mfr_mpn)

    breaks = _price_breaks_from_part(part)
    unit_price, break_qty = select_price_break(breaks, required_qty or 1)
    qty_available = _stock_from_part(part)

    if exact and unit_price is not None:
        status = "matched"
        reason = "exact_mpn"
    elif unit_price is not None:
        status = "possible_match"
        reason = "keyword_search"
    else:
        status = "not_found"
        reason = "no_pricing"

    return SupplierPriceResult(
        supplier=SUPPLIER_MOUSER,
        mpn=mpn,
        manufacturer=part.get("Manufacturer"),
        matched_mpn=mfr_mpn,
        supplier_part_number=part.get("MouserPartNumber"),
        product_url=part.get("ProductDetailUrl"),
        description=part.get("Description"),
        currency=part.get("Currency") or "USD",
        unit_price_for_required_qty=unit_price,
        price_break_qty=break_qty,
        available_qty=qty_available,
        lead_time=part.get("LeadTime"),
        lifecycle_status=part.get("LifecycleStatus") or part.get("PartStatus"),
        is_exact_match=exact,
        match_status=status,
        match_reason=reason,
        raw_response=raw,
    )


class MouserClient:
    def __init__(self, settings: Settings):
        self.settings = settings

    def credentials_configured(self) -> bool:
        return self.settings.mouser_configured

    def _ensure_credentials(self) -> None:
        if not self.credentials_configured():
            raise SupplierApiError(
                "Mouser API credentials missing (MOUSER_API_KEY)",
                supplier=SUPPLIER_MOUSER,
            )

    def _post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        self._ensure_credentials()
        retries = max(0, self.settings.supplier_api_max_retries)
        last_error: Exception | None = None
        url = f"{MOUSER_API_BASE}{path}?apiKey={self.settings.mouser_api_key}"
        headers = {"Content-Type": "application/json", "Accept": "application/json"}

        for attempt in range(retries + 1):
            try:
                with httpx.Client(timeout=self.settings.supplier_api_timeout_seconds) as client:
                    resp = client.post(url, headers=headers, json=body)
                if resp.status_code >= 400:
                    raise SupplierApiError(
                        _redact_api_key(
                            f"Mouser API error {resp.status_code}: {resp.text[:500]}"
                        ),
                        supplier=SUPPLIER_MOUSER,
                    )
                data = resp.json()
                api_errors = _mouser_errors(data)
                parts = (data.get("SearchResults") or {}).get("Parts") or []
                if api_errors and not parts:
                    raise SupplierApiError(
                        f"Mouser API returned errors: {'; '.join(api_errors)}",
                        supplier=SUPPLIER_MOUSER,
                    )
                return data
            except SupplierApiError:
                raise
            except Exception as exc:
                last_error = exc
                if attempt < retries:
                    time.sleep(0.5 * (attempt + 1))
        raise SupplierApiError(
            _redact_api_key(f"Mouser API request failed: {last_error}"),
            supplier=SUPPLIER_MOUSER,
        )

    def _extract_parts(self, data: dict) -> list[dict]:
        search_results = data.get("SearchResults") or {}
        parts = search_results.get("Parts") or []
        return [p for p in parts if isinstance(p, dict)]

    def _keyword_search(self, keyword: str) -> tuple[dict, list[dict]]:
        body = {
            "SearchByKeywordRequest": {
                "keyword": keyword,
                "records": 50,
                "startingRecord": 0,
            }
        }
        data = self._post("/search/keyword", body)
        return data, self._extract_parts(data)

    def search_by_mpn(self, mpn: str, required_qty: float) -> SupplierPriceResult:
        if self.settings.supplier_api_mock:
            return self._mock_result(mpn, required_qty)

        searched = normalize_mpn(mpn)
        if not searched:
            return SupplierPriceResult(
                supplier=SUPPLIER_MOUSER,
                mpn=mpn,
                match_status="error",
                match_reason="empty_mpn",
            )

        try:
            data, parts = self._keyword_search(searched)

            if not parts:
                logger.info("Mouser no products for MPN=%s", searched)
                return SupplierPriceResult(
                    supplier=SUPPLIER_MOUSER,
                    mpn=mpn,
                    match_status="not_found",
                    match_reason="no_products",
                    raw_response=data,
                )

            exact_parts = [
                p
                for p in parts
                if mpn_exact_match(searched, p.get("ManufacturerPartNumber"))
            ]
            pool = exact_parts if exact_parts else parts
            best = _pick_best_part(pool, searched=searched, required_qty=required_qty)

            return _parse_mouser_part(
                best,
                searched=searched,
                mpn=mpn,
                required_qty=required_qty,
                raw=data,
            )
        except SupplierApiError:
            raise
        except Exception as exc:
            logger.exception("Mouser parse/search failed for MPN=%s", searched)
            return SupplierPriceResult(
                supplier=SUPPLIER_MOUSER,
                mpn=mpn,
                match_status="error",
                match_reason=f"parse_error: {exc}",
            )

    def _mock_result(self, mpn: str, required_qty: float) -> SupplierPriceResult:
        searched = normalize_mpn(mpn)
        if not searched:
            return SupplierPriceResult(
                supplier=SUPPLIER_MOUSER,
                mpn=mpn,
                match_status="error",
                match_reason="mock_empty_mpn",
            )
        unit = round(0.012 + (len(searched) % 5) * 0.004, 4)
        return SupplierPriceResult(
            supplier=SUPPLIER_MOUSER,
            mpn=mpn,
            manufacturer="Mock Mfr",
            matched_mpn=searched,
            supplier_part_number=f"MOCK-{searched[:12]}",
            product_url="https://example.com/mock/mouser",
            description=f"MOCK Mouser result for {searched}",
            currency="USD",
            unit_price_for_required_qty=unit,
            price_break_qty=1,
            available_qty=max(required_qty, 50),
            lead_time="1 week",
            lifecycle_status="Active",
            is_exact_match=True,
            match_status="matched",
            match_reason="mock_response",
            raw_response={"mock": True, "supplier": SUPPLIER_MOUSER},
        )
