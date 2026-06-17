"""Digi-Key official supplier API client (Product Information API v4)."""

from __future__ import annotations

import json
import logging
import time
from typing import Any

import httpx

from app.config import Settings
from app.services.suppliers.base import (
    SUPPLIER_DIGIKEY,
    SupplierApiError,
    SupplierPriceResult,
    decimal_or_none,
    mpn_exact_match,
    normalize_mpn,
    select_price_break,
)

logger = logging.getLogger(__name__)

# Module-level OAuth token cache: {cache_key: (token, expires_at_epoch)}
_OAUTH_CACHE: dict[str, tuple[str, float]] = {}


def _digikey_cache_key(settings: Settings) -> str:
    return f"{settings.digikey_env}:{settings.digikey_client_id}"


def _digikey_locale_headers(settings: Settings) -> dict[str, str]:
    return {
        "X-DIGIKEY-Client-Id": settings.digikey_client_id,
        "X-DIGIKEY-Locale-Site": "US",
        "X-DIGIKEY-Locale-Language": "en",
        "X-DIGIKEY-Locale-Currency": "USD",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _dig_value(obj: Any, *keys: str) -> Any:
    for key in keys:
        if isinstance(obj, dict) and key in obj:
            return obj[key]
    return None


def _manufacturer_name(product: dict) -> str | None:
    mfr = product.get("Manufacturer")
    if isinstance(mfr, dict):
        return mfr.get("Name") or mfr.get("Value")
    if isinstance(mfr, str):
        return mfr
    return None


def _product_status(product: dict) -> str | None:
    status = product.get("ProductStatus")
    if isinstance(status, dict):
        return status.get("Status") or status.get("Value")
    if isinstance(status, str):
        return status
    return product.get("PartStatus")


def _product_description(product: dict) -> str | None:
    desc = product.get("Description")
    if isinstance(desc, dict):
        return desc.get("ProductDescription") or desc.get("DetailedDescription")
    if isinstance(desc, str):
        return desc
    return None


def _manufacturer_mpn(product: dict) -> str | None:
    return (
        product.get("ManufacturerProductNumber")
        or product.get("ManufacturerPartNumber")
    )


def _collect_price_breaks(product: dict) -> list[tuple[float, float]]:
    breaks: list[tuple[float, float]] = []

    for pb in product.get("StandardPricing") or []:
        if isinstance(pb, dict):
            qty = decimal_or_none(pb.get("BreakQuantity"))
            price = decimal_or_none(pb.get("UnitPrice"))
            if qty is not None and price is not None:
                breaks.append((qty, price))

    variations = product.get("ProductVariations") or []
    if not isinstance(variations, list):
        variations = []

    for variation in variations:
        if not isinstance(variation, dict):
            continue
        for pb in variation.get("StandardPricing") or []:
            if isinstance(pb, dict):
                qty = decimal_or_none(pb.get("BreakQuantity"))
                price = decimal_or_none(pb.get("UnitPrice"))
                if qty is not None and price is not None:
                    breaks.append((qty, price))

    # Deduplicate by break qty keeping lowest price
    merged: dict[float, float] = {}
    for qty, price in breaks:
        if qty not in merged or price < merged[qty]:
            merged[qty] = price
    return sorted(merged.items(), key=lambda x: x[0])


def _best_variation(product: dict) -> dict | None:
    variations = product.get("ProductVariations") or []
    if not isinstance(variations, list) or not variations:
        return None
    best = variations[0]
    best_score = -1.0
    for var in variations:
        if not isinstance(var, dict):
            continue
        stock = decimal_or_none(var.get("QuantityAvailableforPackageType")) or 0
        pricing = var.get("StandardPricing") or []
        score = stock + (1000 if pricing else 0)
        if score > best_score:
            best = var
            best_score = score
    return best if isinstance(best, dict) else None


def _parse_digikey_product(
    product: dict, *, searched: str, mpn: str, required_qty: float, raw: dict
) -> SupplierPriceResult:
    mfr_mpn = _manufacturer_mpn(product)
    exact = mpn_exact_match(searched, str(mfr_mpn) if mfr_mpn else None)

    variation = _best_variation(product)
    dk_pn = (
        (variation or {}).get("DigiKeyProductNumber")
        or product.get("DigiKeyPartNumber")
        or product.get("DigiKeyProductNumber")
    )

    breaks = _collect_price_breaks(product)
    unit_price, break_qty = select_price_break(breaks, required_qty or 1)

    qty_available = decimal_or_none(product.get("QuantityAvailable"))
    if qty_available is None and variation:
        qty_available = decimal_or_none(variation.get("QuantityAvailableforPackageType"))

    lead_weeks = product.get("ManufacturerLeadWeeks")
    lead_time = f"{lead_weeks} weeks" if lead_weeks not in (None, "") else None

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
        supplier=SUPPLIER_DIGIKEY,
        mpn=mpn,
        manufacturer=_manufacturer_name(product),
        matched_mpn=str(mfr_mpn).strip() if mfr_mpn else None,
        supplier_part_number=dk_pn,
        product_url=product.get("ProductUrl") or product.get("DatasheetUrl"),
        description=_product_description(product),
        currency="USD",
        unit_price_for_required_qty=unit_price,
        price_break_qty=break_qty,
        available_qty=qty_available,
        lead_time=lead_time,
        lifecycle_status=_product_status(product),
        is_exact_match=exact,
        match_status=status,
        match_reason=reason,
        raw_response=raw,
    )


class DigiKeyClient:
    def __init__(self, settings: Settings):
        self.settings = settings

    def credentials_configured(self) -> bool:
        return self.settings.digikey_configured

    def _ensure_credentials(self) -> None:
        if not self.credentials_configured():
            raise SupplierApiError(
                "Digi-Key API credentials missing (DIGIKEY_CLIENT_ID / DIGIKEY_CLIENT_SECRET)",
                supplier=SUPPLIER_DIGIKEY,
            )

    def _get_access_token(self) -> str:
        cache_key = _digikey_cache_key(self.settings)
        now = time.time()
        cached = _OAUTH_CACHE.get(cache_key)
        if cached and now < cached[1] - 30:
            return cached[0]

        url = f"{self.settings.digikey_api_base}/v1/oauth2/token"
        data = {
            "client_id": self.settings.digikey_client_id,
            "client_secret": self.settings.digikey_client_secret,
            "grant_type": "client_credentials",
        }
        with httpx.Client(timeout=self.settings.supplier_api_timeout_seconds) as client:
            resp = client.post(
                url,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        if resp.status_code >= 400:
            raise SupplierApiError(
                f"Digi-Key OAuth failed {resp.status_code}: {resp.text[:500]}",
                supplier=SUPPLIER_DIGIKEY,
            )
        payload = resp.json()
        token = payload.get("access_token")
        if not token:
            raise SupplierApiError(
                f"Digi-Key OAuth response missing access_token: {payload}",
                supplier=SUPPLIER_DIGIKEY,
            )
        expires_in = int(payload.get("expires_in", 599))
        _OAUTH_CACHE[cache_key] = (token, now + expires_in)
        return token

    def _request(
        self,
        method: str,
        path: str,
        *,
        json_body: dict | None = None,
    ) -> dict[str, Any]:
        self._ensure_credentials()
        retries = max(0, self.settings.supplier_api_max_retries)
        last_error: Exception | None = None

        for attempt in range(retries + 1):
            try:
                token = self._get_access_token()
                headers = _digikey_locale_headers(self.settings)
                headers["Authorization"] = f"Bearer {token}"
                url = f"{self.settings.digikey_api_base}{path}"
                with httpx.Client(timeout=self.settings.supplier_api_timeout_seconds) as client:
                    resp = client.request(method, url, headers=headers, json=json_body)
                if resp.status_code == 401 and attempt < retries:
                    _OAUTH_CACHE.pop(_digikey_cache_key(self.settings), None)
                    continue
                if resp.status_code >= 400:
                    raise SupplierApiError(
                        f"Digi-Key API error {resp.status_code}: {resp.text[:500]}",
                        supplier=SUPPLIER_DIGIKEY,
                    )
                return resp.json()
            except SupplierApiError:
                raise
            except Exception as exc:
                last_error = exc
                if attempt < retries:
                    time.sleep(0.5 * (attempt + 1))
        raise SupplierApiError(
            f"Digi-Key API request failed: {last_error}",
            supplier=SUPPLIER_DIGIKEY,
        )

    def search_by_mpn(self, mpn: str, required_qty: float) -> SupplierPriceResult:
        if self.settings.supplier_api_mock:
            return self._mock_result(mpn, required_qty)

        searched = normalize_mpn(mpn)
        if not searched:
            return SupplierPriceResult(
                supplier=SUPPLIER_DIGIKEY,
                mpn=mpn,
                match_status="error",
                match_reason="empty_mpn",
            )

        try:
            body = {
                "Keywords": searched,
                "Limit": 10,
                "Offset": 0,
            }
            data = self._request("POST", "/products/v4/search/keyword", json_body=body)
            products = data.get("Products") or []
            if not isinstance(products, list) or not products:
                logger.info("Digi-Key no products for MPN=%s response_keys=%s", searched, list(data.keys()))
                return SupplierPriceResult(
                    supplier=SUPPLIER_DIGIKEY,
                    mpn=mpn,
                    match_status="not_found",
                    match_reason="no_products",
                    raw_response=data,
                )

            best = products[0]
            for product in products:
                if not isinstance(product, dict):
                    continue
                if mpn_exact_match(searched, _manufacturer_mpn(product)):
                    best = product
                    break

            return _parse_digikey_product(
                best,
                searched=searched,
                mpn=mpn,
                required_qty=required_qty,
                raw=data,
            )
        except SupplierApiError:
            raise
        except Exception as exc:
            logger.exception("Digi-Key parse/search failed for MPN=%s", searched)
            return SupplierPriceResult(
                supplier=SUPPLIER_DIGIKEY,
                mpn=mpn,
                match_status="error",
                match_reason=f"parse_error: {exc}",
            )

    def _mock_result(self, mpn: str, required_qty: float) -> SupplierPriceResult:
        searched = normalize_mpn(mpn)
        if not searched:
            return SupplierPriceResult(
                supplier=SUPPLIER_DIGIKEY,
                mpn=mpn,
                match_status="error",
                match_reason="mock_empty_mpn",
            )
        unit = round(0.01 + (len(searched) % 7) * 0.005, 4)
        return SupplierPriceResult(
            supplier=SUPPLIER_DIGIKEY,
            mpn=mpn,
            manufacturer="Mock Mfr",
            matched_mpn=searched,
            supplier_part_number=f"DK-MOCK-{searched[:12]}",
            product_url="https://example.com/mock/digikey",
            description=f"MOCK Digi-Key result for {searched}",
            currency="USD",
            unit_price_for_required_qty=unit,
            price_break_qty=1,
            available_qty=max(required_qty, 100),
            lead_time="2 weeks",
            lifecycle_status="Active",
            is_exact_match=True,
            match_status="matched",
            match_reason="mock_response",
            raw_response={"mock": True, "supplier": SUPPLIER_DIGIKEY},
        )
