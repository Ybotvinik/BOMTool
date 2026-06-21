"""Shared persistence helpers for official supplier pricing."""

from __future__ import annotations

import json

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.models import (
    BomLine,
    OfficialSupplierPriceResult,
    OfficialSupplierQuery,
)
from app.services.suppliers.base import (
    SUPPLIER_DIGIKEY,
    SUPPLIER_MOUSER,
    SUPPLIER_TI,
    SupplierPriceResult,
    normalize_mpn,
)

DEFAULT_SUPPLIER_PRIORITY = [SUPPLIER_DIGIKEY, SUPPLIER_MOUSER, SUPPLIER_TI]


def is_dnp_line(line: BomLine) -> bool:
    if line.dnp:
        return True
    if line.required_qty is not None and float(line.required_qty) == 0:
        return True
    return False


def save_supplier_result(
    db: Session,
    *,
    query_id: int,
    bom_line_id: int,
    supplier: str,
    original_mpn: str | None,
    required_qty: float | None,
    result: SupplierPriceResult,
) -> OfficialSupplierPriceResult:
    row = OfficialSupplierPriceResult(
        query_id=query_id,
        bom_line_id=bom_line_id,
        supplier=supplier,
        original_mpn=original_mpn,
        searched_mpn=normalize_mpn(original_mpn),
        manufacturer=result.manufacturer,
        supplier_part_number=result.supplier_part_number,
        supplier_product_url=result.product_url,
        description=result.description,
        currency=result.currency,
        unit_price=result.unit_price_for_required_qty,
        price_break_qty=result.price_break_qty,
        required_qty=required_qty,
        available_qty=result.available_qty,
        lead_time=result.lead_time,
        lifecycle_status=result.lifecycle_status,
        is_exact_match=result.is_exact_match,
        match_status=result.match_status,
        match_reason=result.match_reason,
        raw_response_json=json.dumps(result.raw_response) if result.raw_response else None,
    )
    db.add(row)
    return row


def latest_results_by_line(
    db: Session,
    bom_version_id: int,
    suppliers: list[str] | None = None,
    settings: Settings | None = None,
) -> dict[tuple[int, str], OfficialSupplierPriceResult]:
    settings = settings or get_settings()
    q = (
        select(OfficialSupplierPriceResult)
        .join(OfficialSupplierQuery, OfficialSupplierQuery.id == OfficialSupplierPriceResult.query_id)
        .where(OfficialSupplierQuery.bom_version_id == bom_version_id)
        .order_by(OfficialSupplierPriceResult.created_at.desc())
    )
    if suppliers:
        q = q.where(OfficialSupplierPriceResult.supplier.in_(suppliers))
    if not settings.supplier_api_mock:
        q = q.where(OfficialSupplierQuery.is_mock.is_(False))

    out: dict[tuple[int, str], OfficialSupplierPriceResult] = {}
    for row in db.scalars(q):
        key = (row.bom_line_id, row.supplier)
        if key not in out:
            out[key] = row
    return out
