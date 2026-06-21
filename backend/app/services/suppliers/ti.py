"""Texas Instruments store inventory and pricing API client."""

from __future__ import annotations

import logging
import re
import time
from typing import Any
from urllib.parse import quote

import httpx

from app.config import Settings
from app.services.suppliers.base import (
    SUPPLIER_TI,
    SupplierApiError,
    SupplierPriceResult,
    decimal_or_none,
    mpn_exact_match,
    normalize_mpn,
    select_price_break,
)

logger = logging.getLogger(__name__)

TI_API_BASE = "https://transact.ti.com/v2"
TI_OAUTH_URL = "https://transact.ti.com/v1/oauth/accesstoken"
# TI's gateway returns 403 for httpx's default python-httpx User-Agent.
TI_HTTP_HEADERS = {
    "User-Agent": "GlinTech-BOM-Insight/1.0",
    "Accept": "application/json",
}

_OAUTH_CACHE: dict[str, tuple[str, float]] = {}


def _ti_cache_key(settings: Settings) -> str:
    return f"ti:{settings.ti_client_id}"


def _redact_secret(text: str) -> str:
    return re.sub(r"client_secret=[^&\s\"']+", "client_secret=***", text, flags=re.IGNORECASE)


def _usd_price_breaks(product: dict) -> list[tuple[float, float]]:
    breaks: list[tuple[float, float]] = []
    for pricing in product.get("pricing") or []:
        if not isinstance(pricing, dict):
            continue
        currency = (pricing.get("currency") or "USD").upper()
        if currency != "USD":
            continue
        for pb in pricing.get("priceBreaks") or []:
            if not isinstance(pb, dict):
                continue
            qty = decimal_or_none(pb.get("priceBreakQuantity"))
            price = decimal_or_none(pb.get("price"))
            if qty is not None and price is not None:
                breaks.append((qty, price))
    return breaks


def _product_sort_key(product: dict, *, searched: str, required_qty: float) -> tuple:
    gpn = product.get("genericPartNumber")
    opn = product.get("tiPartNumber")
    exact = mpn_exact_match(searched, gpn) or mpn_exact_match(searched, opn)
    stock = decimal_or_none(product.get("quantity")) or 0
    breaks = _usd_price_breaks(product)
    unit_price, _ = select_price_break(breaks, required_qty or 1)
    price = unit_price if unit_price is not None else 999999.0
    return (0 if exact else 1, 0 if stock > 0 else 1, price)


def _pick_best_product(
    products: list[dict], *, searched: str, required_qty: float
) -> dict:
    return min(
        products,
        key=lambda p: _product_sort_key(p, searched=searched, required_qty=required_qty),
    )


def _parse_ti_product(
    product: dict, *, searched: str, mpn: str, required_qty: float, raw: dict
) -> SupplierPriceResult:
    gpn = product.get("genericPartNumber")
    opn = product.get("tiPartNumber")
    if isinstance(gpn, str):
        gpn = gpn.strip() or None
    if isinstance(opn, str):
        opn = opn.strip() or None

    exact = mpn_exact_match(searched, gpn) or mpn_exact_match(searched, opn)
    breaks = _usd_price_breaks(product)
    unit_price, break_qty = select_price_break(breaks, required_qty or 1)
    qty_available = decimal_or_none(product.get("quantity"))

    if exact and unit_price is not None:
        status = "matched"
        reason = "exact_mpn"
    elif unit_price is not None:
        status = "possible_match"
        reason = "gpn_search"
    else:
        status = "not_found"
        reason = "no_pricing"

    return SupplierPriceResult(
        supplier=SUPPLIER_TI,
        mpn=mpn,
        manufacturer="Texas Instruments",
        matched_mpn=gpn or opn,
        supplier_part_number=opn,
        product_url=product.get("buyNowUrl"),
        description=product.get("description"),
        currency="USD",
        unit_price_for_required_qty=unit_price,
        price_break_qty=break_qty,
        available_qty=qty_available,
        lead_time=None,
        lifecycle_status=product.get("lifeCycle"),
        is_exact_match=exact,
        match_status=status,
        match_reason=reason,
        raw_response=raw,
    )


class TIClient:
    def __init__(self, settings: Settings):
        self.settings = settings

    def credentials_configured(self) -> bool:
        return self.settings.ti_configured

    def _ensure_credentials(self) -> None:
        if not self.credentials_configured():
            raise SupplierApiError(
                "TI API credentials missing (TI_CLIENT_ID / TI_CLIENT_SECRET)",
                supplier=SUPPLIER_TI,
            )

    def _get_access_token(self) -> str:
        cache_key = _ti_cache_key(self.settings)
        now = time.time()
        cached = _OAUTH_CACHE.get(cache_key)
        if cached and now < cached[1] - 30:
            return cached[0]

        client_id = self.settings.ti_client_id.strip()
        client_secret = self.settings.ti_client_secret.strip()
        body = (
            f"grant_type=client_credentials"
            f"&client_id={client_id}"
            f"&client_secret={client_secret}"
        )
        with httpx.Client(timeout=self.settings.supplier_api_timeout_seconds) as client:
            resp = client.post(
                TI_OAUTH_URL,
                content=body.encode(),
                headers={
                    **TI_HTTP_HEADERS,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )
        if resp.status_code == 403:
            raise SupplierApiError(
                "TI OAuth 403 Forbidden: the API Key / Secret pair in TI_CLIENT_ID and "
                "TI_CLIENT_SECRET was rejected by TI. In myTI → API Keys and Access → "
                "TI store API suite → API details, copy the API Key and API Secret "
                "(not the Key alone). If both are correct, use Regenerate key and update "
                ".env, or contact TI API support — the portal can show Active while OAuth "
                "is still blocked for the key pair.",
                supplier=SUPPLIER_TI,
            )
        if resp.status_code >= 400:
            raise SupplierApiError(
                _redact_secret(
                    f"TI OAuth failed {resp.status_code}: {resp.text[:500]}"
                ),
                supplier=SUPPLIER_TI,
            )
        payload = resp.json()
        token = payload.get("access_token")
        if not token:
            raise SupplierApiError(
                f"TI OAuth response missing access_token: {payload}",
                supplier=SUPPLIER_TI,
            )
        expires_in = int(payload.get("expires_in", 3599))
        _OAUTH_CACHE[cache_key] = (token, now + expires_in)
        return token

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        self._ensure_credentials()
        retries = max(0, self.settings.supplier_api_max_retries)
        last_error: Exception | None = None

        for attempt in range(retries + 1):
            try:
                token = self._get_access_token()
                headers = {
                    **TI_HTTP_HEADERS,
                    "Authorization": f"Bearer {token}",
                }
                url = f"{TI_API_BASE}{path}"
                with httpx.Client(timeout=self.settings.supplier_api_timeout_seconds) as client:
                    resp = client.request(method, url, headers=headers, params=params)
                if resp.status_code == 401 and attempt < retries:
                    _OAUTH_CACHE.pop(_ti_cache_key(self.settings), None)
                    continue
                if resp.status_code == 404:
                    return {"_not_found": True, "status": 404}
                if resp.status_code >= 400:
                    raise SupplierApiError(
                        f"TI API error {resp.status_code}: {resp.text[:500]}",
                        supplier=SUPPLIER_TI,
                    )
                return resp.json()
            except SupplierApiError:
                raise
            except Exception as exc:
                last_error = exc
                if attempt < retries:
                    time.sleep(0.5 * (attempt + 1))
        raise SupplierApiError(
            f"TI API request failed: {last_error}",
            supplier=SUPPLIER_TI,
        )

    def _get_product_by_opn(self, ti_part_number: str) -> dict[str, Any] | None:
        encoded = quote(ti_part_number, safe="")
        data = self._request(
            "GET",
            f"/store/products/{encoded}",
            params={"currency": "USD"},
        )
        if data.get("_not_found"):
            return None
        if data.get("tiPartNumber"):
            return data
        return None

    def _search_by_gpn(self, gpn: str) -> tuple[dict[str, Any], list[dict]]:
        data = self._request(
            "GET",
            "/store/products",
            params={"gpn": gpn, "page": 0, "size": 50, "currency": "USD"},
        )
        content = data.get("content") or []
        products = [p for p in content if isinstance(p, dict)]
        return data, products

    def search_by_mpn(self, mpn: str, required_qty: float) -> SupplierPriceResult:
        if self.settings.supplier_api_mock:
            return self._mock_result(mpn, required_qty)

        searched = normalize_mpn(mpn)
        if not searched:
            return SupplierPriceResult(
                supplier=SUPPLIER_TI,
                mpn=mpn,
                match_status="error",
                match_reason="empty_mpn",
            )

        try:
            product = self._get_product_by_opn(searched)
            if product:
                return _parse_ti_product(
                    product,
                    searched=searched,
                    mpn=mpn,
                    required_qty=required_qty,
                    raw=product,
                )

            data, products = self._search_by_gpn(searched)
            if not products:
                logger.info("TI no products for MPN=%s", searched)
                return SupplierPriceResult(
                    supplier=SUPPLIER_TI,
                    mpn=mpn,
                    match_status="not_found",
                    match_reason="no_products",
                    raw_response=data,
                )

            exact_products = [
                p
                for p in products
                if mpn_exact_match(searched, p.get("genericPartNumber"))
                or mpn_exact_match(searched, p.get("tiPartNumber"))
            ]
            pool = exact_products if exact_products else products
            best = _pick_best_product(pool, searched=searched, required_qty=required_qty)
            return _parse_ti_product(
                best,
                searched=searched,
                mpn=mpn,
                required_qty=required_qty,
                raw=data,
            )
        except SupplierApiError:
            raise
        except Exception as exc:
            logger.exception("TI parse/search failed for MPN=%s", searched)
            return SupplierPriceResult(
                supplier=SUPPLIER_TI,
                mpn=mpn,
                match_status="error",
                match_reason=f"parse_error: {exc}",
            )

    def _mock_result(self, mpn: str, required_qty: float) -> SupplierPriceResult:
        searched = normalize_mpn(mpn)
        if not searched:
            return SupplierPriceResult(
                supplier=SUPPLIER_TI,
                mpn=mpn,
                match_status="error",
                match_reason="mock_empty_mpn",
            )
        unit = round(0.015 + (len(searched) % 7) * 0.003, 4)
        return SupplierPriceResult(
            supplier=SUPPLIER_TI,
            mpn=mpn,
            manufacturer="Texas Instruments",
            matched_mpn=searched,
            supplier_part_number=f"TI-{searched[:12]}",
            product_url="https://example.com/mock/ti",
            description=f"MOCK TI result for {searched}",
            currency="USD",
            unit_price_for_required_qty=unit,
            price_break_qty=1,
            available_qty=max(required_qty, 100),
            lead_time=None,
            lifecycle_status="ACTIVE",
            is_exact_match=True,
            match_status="matched",
            match_reason="mock_response",
            raw_response={"mock": True, "supplier": SUPPLIER_TI},
        )
