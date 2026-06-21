"""Ad-hoc single-component official supplier price lookups with persistent log."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import desc, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.config import Settings, get_settings
from app.models import (
    BomLine,
    BomVersion,
    ComponentPriceLookup,
    ComponentPriceLookupAddition,
    ComponentPriceLookupResult,
    OfficialSupplierQuery,
    Project,
)
from app.services.activity import log_activity
from app.services.bom_quality import clean_mpn, compute_required_qty
from app.services.suppliers.base import (
    OFFICIAL_API_SUPPLIERS,
    SUPPLIER_DISPLAY_NAMES,
    SupplierApiError,
    SupplierPriceResult,
)
from app.services.suppliers.mpn_cross_reference import build_mpn_cross_references
from app.services.suppliers.digikey import DigiKeyClient
from app.services.suppliers.mouser import MouserClient
from app.services.suppliers.pricing_store import save_supplier_result
from app.services.suppliers.ti import TIClient

logger = logging.getLogger(__name__)


def _reload_lookup(db: Session, lookup_id: int) -> ComponentPriceLookup:
    row = db.scalar(
        select(ComponentPriceLookup)
        .where(ComponentPriceLookup.id == lookup_id)
        .options(
            selectinload(ComponentPriceLookup.results),
            selectinload(ComponentPriceLookup.project_additions),
        )
    )
    if row is None:
        raise ValueError("Lookup not found")
    return row


def _client_for_supplier(supplier: str, settings: Settings):
    if supplier == "digikey":
        return DigiKeyClient(settings)
    if supplier == "mouser":
        return MouserClient(settings)
    if supplier == "ti":
        return TIClient(settings)
    raise ValueError(f"Unknown supplier: {supplier}")


def _lookup_suppliers(suppliers: list[str] | None) -> list[str]:
    if not suppliers:
        return sorted(OFFICIAL_API_SUPPLIERS)
    return [s for s in suppliers if s in OFFICIAL_API_SUPPLIERS]


def _run_supplier_lookups(
    *,
    mpn: str,
    required_qty: float,
    suppliers: list[str],
    settings: Settings,
) -> list[SupplierPriceResult]:
    results: list[SupplierPriceResult] = []
    for supplier in suppliers:
        client = _client_for_supplier(supplier, settings)
        if not settings.supplier_api_mock and not client.credentials_configured():
            name = SUPPLIER_DISPLAY_NAMES.get(supplier, supplier)
            results.append(
                SupplierPriceResult(
                    supplier=supplier,
                    mpn=mpn,
                    match_status="error",
                    match_reason=f"{name} API credentials missing",
                )
            )
            continue
        try:
            results.append(client.search_by_mpn(mpn, required_qty))
        except SupplierApiError as exc:
            results.append(
                SupplierPriceResult(
                    supplier=supplier,
                    mpn=mpn,
                    match_status="error",
                    match_reason=exc.message,
                )
            )
    return results


def _save_lookup_results(
    db: Session,
    lookup: ComponentPriceLookup,
    results: list[SupplierPriceResult],
) -> None:
    lookup.results.clear()
    db.flush()
    for result in results:
        lookup.results.append(
            ComponentPriceLookupResult(
                supplier=result.supplier,
                matched_mpn=result.matched_mpn,
                manufacturer=result.manufacturer,
                description=result.description,
                supplier_part_number=result.supplier_part_number,
                product_url=result.product_url,
                currency=result.currency,
                unit_price=result.unit_price_for_required_qty,
                price_break_qty=result.price_break_qty,
                available_qty=result.available_qty,
                lead_time=result.lead_time,
                lifecycle_status=result.lifecycle_status,
                is_exact_match=result.is_exact_match,
                match_status=result.match_status,
                match_reason=result.match_reason,
            )
        )


def _best_offer_row(
    lookup: ComponentPriceLookup,
    preferred_supplier: str | None,
) -> ComponentPriceLookupResult | None:
    rows = list(lookup.results)
    if not rows:
        return None
    if preferred_supplier:
        for row in rows:
            if row.supplier == preferred_supplier and row.unit_price is not None:
                return row
    priced = [
        r
        for r in rows
        if r.unit_price is not None and r.match_status in ("matched", "possible_match")
    ]
    if not priced:
        return rows[0]
    exact = [r for r in priced if r.is_exact_match]
    pool = exact if exact else priced
    return min(pool, key=lambda r: float(r.unit_price or 999999))


def _persist_lookup_results_to_bom_line(
    db: Session,
    *,
    lookup: ComponentPriceLookup,
    bom_line: BomLine,
    project_id: int,
    bom_version_id: int,
    user_id: int | None,
    settings: Settings,
) -> None:
    is_mock = settings.supplier_api_mock
    for row in lookup.results:
        query = OfficialSupplierQuery(
            project_id=project_id,
            bom_version_id=bom_version_id,
            supplier=row.supplier,
            status="completed",
            started_by_user_id=user_id,
            total_lines=1,
            matched_lines=1 if row.unit_price is not None else 0,
            missing_lines=0 if row.unit_price is not None else 1,
            is_mock=is_mock,
            completed_at=datetime.now(timezone.utc),
        )
        db.add(query)
        db.flush()
        save_supplier_result(
            db,
            query_id=query.id,
            bom_line_id=bom_line.id,
            supplier=row.supplier,
            original_mpn=lookup.search_mpn,
            required_qty=float(lookup.required_qty),
            result=SupplierPriceResult(
                supplier=row.supplier,
                mpn=lookup.search_mpn,
                manufacturer=row.manufacturer,
                matched_mpn=row.matched_mpn,
                supplier_part_number=row.supplier_part_number,
                product_url=row.product_url,
                description=row.description,
                currency=row.currency or "USD",
                unit_price_for_required_qty=float(row.unit_price) if row.unit_price is not None else None,
                price_break_qty=float(row.price_break_qty) if row.price_break_qty is not None else None,
                available_qty=float(row.available_qty) if row.available_qty is not None else None,
                lead_time=row.lead_time,
                lifecycle_status=row.lifecycle_status,
                is_exact_match=row.is_exact_match,
                match_status=row.match_status,
                match_reason=row.match_reason,
            ),
        )


def _lookup_to_dict(db: Session, lookup: ComponentPriceLookup) -> dict:
    offers = []
    for row in lookup.results:
        offers.append(
            {
                "supplier": row.supplier,
                "supplier_display": SUPPLIER_DISPLAY_NAMES.get(row.supplier, row.supplier),
                "matched_mpn": row.matched_mpn,
                "manufacturer": row.manufacturer,
                "description": row.description,
                "supplier_part_number": row.supplier_part_number,
                "product_url": row.product_url,
                "currency": row.currency or "USD",
                "unit_price": float(row.unit_price) if row.unit_price is not None else None,
                "price_break_qty": float(row.price_break_qty) if row.price_break_qty is not None else None,
                "available_qty": float(row.available_qty) if row.available_qty is not None else None,
                "lead_time": row.lead_time,
                "lifecycle_status": row.lifecycle_status,
                "is_exact_match": row.is_exact_match,
                "match_status": row.match_status,
                "match_reason": row.match_reason,
            }
        )
    additions = []
    for add in lookup.project_additions:
        additions.append(
            {
                "id": add.id,
                "project_id": add.project_id,
                "bom_version_id": add.bom_version_id,
                "bom_line_id": add.bom_line_id,
                "created_at": add.created_at,
            }
        )
    return {
        "id": lookup.id,
        "search_mpn": lookup.search_mpn,
        "cleaned_mpn": lookup.cleaned_mpn,
        "manufacturer_hint": lookup.manufacturer_hint,
        "required_qty": float(lookup.required_qty),
        "note": lookup.note,
        "is_mock": lookup.is_mock,
        "created_by_user_id": lookup.created_by_user_id,
        "created_at": lookup.created_at,
        "last_checked_at": lookup.last_checked_at,
        "offers": offers,
        "project_additions": additions,
        "cross_references": build_mpn_cross_references(
            db, search_mpn=lookup.search_mpn, exclude_lookup_id=lookup.id
        ),
    }


def _lookup_summary_dict(db: Session, lookup: ComponentPriceLookup) -> dict:
    best = _best_offer_row(lookup, None)
    prev_count = 0
    if lookup.cleaned_mpn:
        prev_count = (
            db.scalar(
                select(func.count(ComponentPriceLookup.id)).where(
                    ComponentPriceLookup.cleaned_mpn == lookup.cleaned_mpn,
                    ComponentPriceLookup.id != lookup.id,
                )
            )
            or 0
        )
    return {
        "id": lookup.id,
        "search_mpn": lookup.search_mpn,
        "cleaned_mpn": lookup.cleaned_mpn,
        "required_qty": float(lookup.required_qty),
        "note": lookup.note,
        "is_mock": lookup.is_mock,
        "created_at": lookup.created_at,
        "last_checked_at": lookup.last_checked_at,
        "best_supplier": best.supplier if best else None,
        "best_supplier_display": (
            SUPPLIER_DISPLAY_NAMES.get(best.supplier, best.supplier) if best else None
        ),
        "best_unit_price": float(best.unit_price) if best and best.unit_price is not None else None,
        "priced_suppliers": sum(
            1
            for r in lookup.results
            if r.unit_price is not None and r.match_status in ("matched", "possible_match")
        ),
        "additions_count": len(lookup.project_additions),
        "previous_lookup_count": int(prev_count),
        "previously_searched": prev_count > 0,
    }


def create_component_lookup(
    db: Session,
    *,
    mpn: str,
    required_qty: float,
    manufacturer_hint: str | None,
    note: str | None,
    suppliers: list[str] | None,
    user_id: int | None,
    settings: Settings | None = None,
) -> dict:
    settings = settings or get_settings()
    search_mpn = (mpn or "").strip()
    if not search_mpn:
        raise ValueError("MPN is required")

    valid_suppliers = _lookup_suppliers(suppliers)
    if not valid_suppliers:
        raise ValueError("No valid suppliers selected")

    qty = float(required_qty or 1)
    if qty <= 0:
        qty = 1.0

    results = _run_supplier_lookups(
        mpn=search_mpn,
        required_qty=qty,
        suppliers=valid_suppliers,
        settings=settings,
    )
    is_mock = settings.supplier_api_mock or any(
        r.match_reason == "mock_response" for r in results
    )

    lookup = ComponentPriceLookup(
        search_mpn=search_mpn,
        cleaned_mpn=clean_mpn(search_mpn),
        manufacturer_hint=(manufacturer_hint or "").strip() or None,
        required_qty=qty,
        note=(note or "").strip() or None,
        is_mock=is_mock,
        created_by_user_id=user_id,
        last_checked_at=datetime.now(timezone.utc),
    )
    db.add(lookup)
    db.flush()
    _save_lookup_results(db, lookup, results)

    log_activity(
        db,
        user_id=user_id,
        action_type="component_lookup_created",
        project_id=None,
        entity_type="component_price_lookup",
        entity_name=search_mpn,
        change_summary=(
            f"Single component lookup for {search_mpn} @ qty {qty} "
            f"({len(valid_suppliers)} suppliers)"
        ),
        commit=False,
    )
    db.commit()
    lookup = _reload_lookup(db, lookup.id)
    return _lookup_to_dict(db, lookup)


def refresh_component_lookup(
    db: Session,
    *,
    lookup_id: int,
    suppliers: list[str] | None,
    user_id: int | None,
    settings: Settings | None = None,
) -> dict:
    settings = settings or get_settings()
    lookup = db.scalar(
        select(ComponentPriceLookup)
        .where(ComponentPriceLookup.id == lookup_id)
        .options(
            selectinload(ComponentPriceLookup.results),
            selectinload(ComponentPriceLookup.project_additions),
        )
    )
    if lookup is None:
        raise ValueError("Lookup not found")

    valid_suppliers = _lookup_suppliers(suppliers)
    if not valid_suppliers:
        raise ValueError("No valid suppliers selected")

    results = _run_supplier_lookups(
        mpn=lookup.search_mpn,
        required_qty=float(lookup.required_qty),
        suppliers=valid_suppliers,
        settings=settings,
    )
    lookup.is_mock = settings.supplier_api_mock or any(
        r.match_reason == "mock_response" for r in results
    )
    lookup.last_checked_at = datetime.now(timezone.utc)
    _save_lookup_results(db, lookup, results)

    log_activity(
        db,
        user_id=user_id,
        action_type="component_lookup_refreshed",
        project_id=None,
        entity_type="component_price_lookup",
        entity_name=lookup.search_mpn,
        change_summary=f"Refreshed single component lookup #{lookup.id} from APIs",
        commit=False,
    )
    db.commit()
    lookup = _reload_lookup(db, lookup.id)
    return _lookup_to_dict(db, lookup)


def get_component_lookup(db: Session, lookup_id: int) -> dict:
    return _lookup_to_dict(db, _reload_lookup(db, lookup_id))


def list_component_lookups(
    db: Session,
    *,
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    stmt = (
        select(ComponentPriceLookup)
        .options(
            selectinload(ComponentPriceLookup.results),
            selectinload(ComponentPriceLookup.project_additions),
        )
        .order_by(desc(ComponentPriceLookup.last_checked_at), desc(ComponentPriceLookup.id))
    )
    if q and q.strip():
        needle = f"%{q.strip().upper()}%"
        stmt = stmt.where(
            or_(
                func.upper(ComponentPriceLookup.search_mpn).like(needle),
                func.upper(ComponentPriceLookup.cleaned_mpn).like(needle),
            )
        )

    rows = list(db.scalars(stmt.offset(offset).limit(limit + 1)))
    has_more = len(rows) > limit
    items = rows[:limit]
    return {
        "items": [_lookup_summary_dict(db, row) for row in items],
        "offset": offset,
        "limit": limit,
        "has_more": has_more,
    }


def add_component_lookup_to_project(
    db: Session,
    *,
    lookup_id: int,
    project_id: int,
    bom_version_id: int,
    quantity_per_assembly: float,
    reference_designators: str | None,
    notes: str | None,
    preferred_supplier: str | None,
    user_id: int | None,
    settings: Settings | None = None,
) -> dict:
    settings = settings or get_settings()
    lookup = db.scalar(
        select(ComponentPriceLookup)
        .where(ComponentPriceLookup.id == lookup_id)
        .options(
            selectinload(ComponentPriceLookup.results),
            selectinload(ComponentPriceLookup.project_additions),
        )
    )
    if lookup is None:
        raise ValueError("Lookup not found")

    project = db.get(Project, project_id)
    if project is None:
        raise ValueError("Project not found")
    version = db.get(BomVersion, bom_version_id)
    if version is None or version.project_id != project_id:
        raise ValueError("BOM version not found")

    qty = Decimal(str(quantity_per_assembly or 1))
    if qty <= 0:
        raise ValueError("quantity_per_assembly must be positive")

    best = _best_offer_row(lookup, preferred_supplier)
    mpn = (best.matched_mpn if best and best.matched_mpn else lookup.search_mpn) or lookup.search_mpn
    manufacturer = (
        (best.manufacturer if best and best.manufacturer else None)
        or lookup.manufacturer_hint
    )
    description = best.description if best else None
    supplier_pn = best.supplier_part_number if best else None

    max_line_no = db.scalar(
        select(func.max(BomLine.line_no)).where(BomLine.bom_version_id == bom_version_id)
    )
    line_no = int(max_line_no or 0) + 1

    line = BomLine(
        bom_version_id=bom_version_id,
        line_no=line_no,
        mpn=mpn,
        manufacturer=manufacturer,
        description=description,
        quantity=qty,
        reference_designators=(reference_designators or "").strip() or None,
        supplier_part_number=supplier_pn,
        cleaned_mpn=clean_mpn(mpn),
        required_qty=compute_required_qty(qty, version.build_quantity, False),
        notes=(notes or "").strip() or f"Added from component lookup #{lookup.id}",
    )
    db.add(line)
    db.flush()

    _persist_lookup_results_to_bom_line(
        db,
        lookup=lookup,
        bom_line=line,
        project_id=project_id,
        bom_version_id=bom_version_id,
        user_id=user_id,
        settings=settings,
    )

    addition = ComponentPriceLookupAddition(
        lookup_id=lookup.id,
        project_id=project_id,
        bom_version_id=bom_version_id,
        bom_line_id=line.id,
        added_by_user_id=user_id,
    )
    db.add(addition)

    log_activity(
        db,
        user_id=user_id,
        action_type="component_lookup_added_to_project",
        project_id=project_id,
        entity_type="bom_line",
        entity_name=mpn,
        change_summary=(
            f"Added component lookup #{lookup.id} ({mpn}) to project "
            f"{project.name} BOM line #{line_no}"
        ),
        commit=False,
    )
    db.commit()

    return {
        "lookup_id": lookup.id,
        "project_id": project_id,
        "bom_version_id": bom_version_id,
        "bom_line_id": line.id,
        "line_no": line_no,
        "mpn": mpn,
    }


def get_mpn_context(db: Session, *, mpn: str, exclude_lookup_id: int | None = None) -> dict:
    return build_mpn_cross_references(
        db, search_mpn=mpn, exclude_lookup_id=exclude_lookup_id
    )
