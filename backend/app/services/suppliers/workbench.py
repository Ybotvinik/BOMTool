"""Supplier pricing workbench — selection, overrides, and row state."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.models import (
    BomLine,
    BomVersion,
    OfficialPricingLineOverride,
    OfficialSupplierPriceResult,
    OfficialSupplierQuery,
    Project,
)
from app.services.activity import log_activity
from app.services.bom_quality import compute_required_qty
from app.services.suppliers.base import (
    SUPPLIER_DIGIKEY,
    SUPPLIER_DISPLAY_NAMES,
    SUPPLIER_MOUSER,
    SupplierApiError,
    SupplierPriceResult,
    normalize_mpn,
)
from app.services.suppliers.digikey import DigiKeyClient
from app.services.suppliers.mouser import MouserClient
from app.services.suppliers.pricing_store import (
    DEFAULT_SUPPLIER_PRIORITY,
    is_dnp_line,
    latest_results_by_line,
    save_supplier_result,
)

SOURCE_TYPE_SUPPLIER = "supplier"
SOURCE_TYPE_MANUAL = "manual"
SOURCE_TYPE_TBD = "tbd"
SOURCE_TYPE_DNP = "dnp"

STATUS_PRICED = "Priced"
STATUS_NEEDS_REVIEW = "Needs Review"
STATUS_MISSING = "Missing"
STATUS_MANUAL = "Manual"
STATUS_DNP = "DNP"
STATUS_NO_STOCK = "No Stock"

SOLUTION_HAS = "Has Solution"
SOLUTION_NEEDS_APPROVAL = "Needs Approval"
SOLUTION_NO = "No Solution"
SOLUTION_DNP = "DNP"


@dataclass
class ResolvedSelection:
    source: str
    supplier_pn: str | None
    unit_price: float | None
    extended_price: float | None
    stock: float | None
    currency: str
    lead_time: str | None
    status: str
    solution_status: str
    notes: str | None
    selected_supplier: str | None
    selected_source_type: str
    manually_approved_possible_match: bool = False
    product_url: str | None = None
    price_break_qty: float | None = None
    match_status: str | None = None
    match_reason: str | None = None


def _client_for_supplier(supplier: str, settings: Settings):
    if supplier == SUPPLIER_DIGIKEY:
        return DigiKeyClient(settings)
    if supplier == SUPPLIER_MOUSER:
        return MouserClient(settings)
    raise ValueError(f"Unknown supplier: {supplier}")


def _search_mpn_for_line(bl: BomLine, override: OfficialPricingLineOverride | None) -> str:
    if override and override.search_mpn_override:
        return normalize_mpn(override.search_mpn_override) or override.search_mpn_override.strip()
    return normalize_mpn(bl.cleaned_mpn or bl.mpn or "") or (bl.cleaned_mpn or bl.mpn or "")


def _overrides_by_line(
    db: Session, project_id: int, bom_version_id: int
) -> dict[int, OfficialPricingLineOverride]:
    rows = list(
        db.scalars(
            select(OfficialPricingLineOverride).where(
                OfficialPricingLineOverride.project_id == project_id,
                OfficialPricingLineOverride.bom_version_id == bom_version_id,
            )
        )
    )
    return {r.bom_line_id: r for r in rows}


def _get_or_create_override(
    db: Session,
    *,
    project_id: int,
    bom_version_id: int,
    bom_line_id: int,
    user_id: int | None,
) -> OfficialPricingLineOverride:
    existing = db.scalar(
        select(OfficialPricingLineOverride).where(
            OfficialPricingLineOverride.project_id == project_id,
            OfficialPricingLineOverride.bom_version_id == bom_version_id,
            OfficialPricingLineOverride.bom_line_id == bom_line_id,
        )
    )
    if existing:
        return existing
    row = OfficialPricingLineOverride(
        project_id=project_id,
        bom_version_id=bom_version_id,
        bom_line_id=bom_line_id,
        created_by_user_id=user_id,
        updated_by_user_id=user_id,
    )
    db.add(row)
    db.flush()
    return row


def _is_exact_result(row: OfficialSupplierPriceResult | None) -> bool:
    return (
        row is not None
        and row.unit_price is not None
        and row.is_exact_match
        and row.match_status == "matched"
    )


def _auto_select_exact(
    candidates: list[OfficialSupplierPriceResult | None],
    priority: list[str],
) -> OfficialSupplierPriceResult | None:
    exact = [c for c in candidates if _is_exact_result(c)]
    if not exact:
        return None

    def sort_key(r: OfficialSupplierPriceResult) -> tuple:
        has_stock = (r.available_qty or 0) > 0
        price = float(r.unit_price or 0)
        pri = priority.index(r.supplier) if r.supplier in priority else 99
        return (0 if has_stock else 1, price, pri)

    return sorted(exact, key=sort_key)[0]


def _has_possible_match(candidates: list[OfficialSupplierPriceResult | None]) -> bool:
    return any(
        c is not None
        and c.unit_price is not None
        and c.match_status == "possible_match"
        for c in candidates
    )


def _result_for_supplier(
    results_map: dict[tuple[int, str], OfficialSupplierPriceResult],
    bom_line_id: int,
    supplier: str | None,
) -> OfficialSupplierPriceResult | None:
    if not supplier:
        return None
    return results_map.get((bom_line_id, supplier))


def _manual_source_label(name: str | None) -> str:
    if not name:
        return "Manual"
    return f"Manual: {name}"


def resolve_line_selection(
    *,
    bl: BomLine,
    req_qty: float,
    results_map: dict[tuple[int, str], OfficialSupplierPriceResult],
    override: OfficialPricingLineOverride | None,
    priority: list[str] | None = None,
    dnp: bool | None = None,
) -> ResolvedSelection:
    priority = priority or DEFAULT_SUPPLIER_PRIORITY
    is_dnp = dnp if dnp is not None else is_dnp_line(bl)

    if is_dnp:
        return ResolvedSelection(
            source="DNP",
            supplier_pn=None,
            unit_price=None,
            extended_price=0.0,
            stock=None,
            currency="USD",
            lead_time=None,
            status=STATUS_DNP,
            solution_status=SOLUTION_DNP,
            notes="DNP / Not populated",
            selected_supplier=None,
            selected_source_type=SOURCE_TYPE_DNP,
        )

    if override and override.user_selected:
        if override.selected_source_type == SOURCE_TYPE_MANUAL:
            unit = float(override.manual_unit_price) if override.manual_unit_price is not None else None
            ext = unit * req_qty if unit is not None else None
            has_price = unit is not None
            return ResolvedSelection(
                source=_manual_source_label(override.manual_supplier_name),
                supplier_pn=override.manual_supplier_part_number,
                unit_price=unit,
                extended_price=ext,
                stock=float(override.manual_stock) if override.manual_stock is not None else None,
                currency=override.manual_currency or "USD",
                lead_time=override.manual_lead_time,
                status=STATUS_MANUAL,
                solution_status=SOLUTION_HAS if has_price else SOLUTION_NEEDS_APPROVAL,
                notes=override.note,
                selected_supplier=None,
                selected_source_type=SOURCE_TYPE_MANUAL,
            )

        if override.selected_source_type == SOURCE_TYPE_TBD:
            possible = _has_possible_match(
                [_result_for_supplier(results_map, bl.id, s) for s in priority]
            )
            return ResolvedSelection(
                source="TBD",
                supplier_pn=None,
                unit_price=None,
                extended_price=None,
                stock=None,
                currency="USD",
                lead_time=None,
                status=STATUS_NEEDS_REVIEW if possible else STATUS_MISSING,
                solution_status=SOLUTION_NEEDS_APPROVAL if possible else SOLUTION_NO,
                notes=override.note,
                selected_supplier=None,
                selected_source_type=SOURCE_TYPE_TBD,
            )

        if override.selected_source_type == SOURCE_TYPE_SUPPLIER and override.selected_supplier:
            row = _result_for_supplier(results_map, bl.id, override.selected_supplier)
            if row and row.unit_price is not None:
                unit = float(row.unit_price)
                stock = float(row.available_qty) if row.available_qty is not None else None
                has_stock = (stock or 0) > 0
                is_possible = row.match_status == "possible_match"
                if is_possible and override.manually_approved_possible_match:
                    status = STATUS_PRICED if has_stock else STATUS_NO_STOCK
                    solution = SOLUTION_HAS if has_stock and row.is_exact_match else SOLUTION_NEEDS_APPROVAL
                    if row.is_exact_match and has_stock:
                        solution = SOLUTION_HAS
                    elif is_possible:
                        solution = SOLUTION_NEEDS_APPROVAL
                        status = STATUS_NEEDS_REVIEW if not has_stock else STATUS_NO_STOCK
                elif is_possible:
                    status = STATUS_NEEDS_REVIEW
                    solution = SOLUTION_NEEDS_APPROVAL
                elif row.is_exact_match:
                    status = STATUS_PRICED if has_stock else STATUS_NO_STOCK
                    solution = SOLUTION_HAS if has_stock else SOLUTION_NEEDS_APPROVAL
                else:
                    status = STATUS_NEEDS_REVIEW
                    solution = SOLUTION_NEEDS_APPROVAL

                return ResolvedSelection(
                    source=SUPPLIER_DISPLAY_NAMES.get(row.supplier, row.supplier),
                    supplier_pn=row.supplier_part_number,
                    unit_price=unit,
                    extended_price=unit * req_qty,
                    stock=stock,
                    currency=row.currency or "USD",
                    lead_time=row.lead_time,
                    status=status,
                    solution_status=solution,
                    notes=override.note or row.match_reason,
                    selected_supplier=row.supplier,
                    selected_source_type=SOURCE_TYPE_SUPPLIER,
                    manually_approved_possible_match=override.manually_approved_possible_match,
                    product_url=row.supplier_product_url,
                    price_break_qty=float(row.price_break_qty) if row.price_break_qty else None,
                    match_status=row.match_status,
                    match_reason=row.match_reason,
                )

    candidates = [_result_for_supplier(results_map, bl.id, s) for s in priority]
    best = _auto_select_exact(candidates, priority)
    if best:
        unit = float(best.unit_price)
        stock = float(best.available_qty) if best.available_qty is not None else None
        has_stock = (stock or 0) > 0
        return ResolvedSelection(
            source=SUPPLIER_DISPLAY_NAMES.get(best.supplier, best.supplier),
            supplier_pn=best.supplier_part_number,
            unit_price=unit,
            extended_price=unit * req_qty,
            stock=stock,
            currency=best.currency or "USD",
            lead_time=best.lead_time,
            status=STATUS_PRICED if has_stock else STATUS_NO_STOCK,
            solution_status=SOLUTION_HAS if has_stock else SOLUTION_NEEDS_APPROVAL,
            notes=best.match_reason,
            selected_supplier=best.supplier,
            selected_source_type=SOURCE_TYPE_SUPPLIER,
            product_url=best.supplier_product_url,
            price_break_qty=float(best.price_break_qty) if best.price_break_qty else None,
            match_status=best.match_status,
            match_reason=best.match_reason,
        )

    if _has_possible_match(candidates):
        return ResolvedSelection(
            source="TBD",
            supplier_pn=None,
            unit_price=None,
            extended_price=None,
            stock=None,
            currency="USD",
            lead_time=None,
            status=STATUS_NEEDS_REVIEW,
            solution_status=SOLUTION_NEEDS_APPROVAL,
            notes="possible_match available — select in offers drawer",
            selected_supplier=None,
            selected_source_type=SOURCE_TYPE_TBD,
        )

    return ResolvedSelection(
        source="TBD",
        supplier_pn=None,
        unit_price=None,
        extended_price=None,
        stock=None,
        currency="USD",
        lead_time=None,
        status=STATUS_MISSING,
        solution_status=SOLUTION_NO,
        notes=None,
        selected_supplier=None,
        selected_source_type=SOURCE_TYPE_TBD,
    )


def _offer_from_result(
    row: OfficialSupplierPriceResult | None, *, req_qty: float
) -> dict | None:
    if row is None:
        return None
    unit = float(row.unit_price) if row.unit_price is not None else None
    return {
        "supplier": row.supplier,
        "supplier_display": SUPPLIER_DISPLAY_NAMES.get(row.supplier, row.supplier),
        "supplier_part_number": row.supplier_part_number,
        "manufacturer": row.manufacturer,
        "unit_price": unit,
        "extended_price": unit * req_qty if unit is not None else None,
        "stock": float(row.available_qty) if row.available_qty is not None else None,
        "price_break_qty": float(row.price_break_qty) if row.price_break_qty else None,
        "match_status": row.match_status,
        "match_reason": row.match_reason,
        "is_exact_match": row.is_exact_match,
        "product_url": row.supplier_product_url,
        "lead_time": row.lead_time,
        "currency": row.currency or "USD",
        "needs_review": row.match_status == "possible_match",
    }


def get_workbench_results(
    db: Session,
    *,
    project_id: int,
    bom_version_id: int,
    priority: list[str] | None = None,
    settings: Settings | None = None,
) -> dict:
    settings = settings or get_settings()
    priority = priority or DEFAULT_SUPPLIER_PRIORITY
    version = db.get(BomVersion, bom_version_id)
    if version is None or version.project_id != project_id:
        raise ValueError("BOM version not found")

    bom_lines = list(
        db.scalars(
            select(BomLine)
            .where(BomLine.bom_version_id == bom_version_id)
            .order_by(BomLine.line_no, BomLine.id)
        )
    )
    results_map = latest_results_by_line(db, bom_version_id, priority, settings=settings)
    overrides = _overrides_by_line(db, project_id, bom_version_id)

    lines: list[dict] = []
    summary = {
        "total_lines": 0,
        "has_solution": 0,
        "needs_approval": 0,
        "no_solution": 0,
        "dnp": 0,
        "selected_total_cost": 0.0,
    }

    for bl in bom_lines:
        req_qty = bl.required_qty
        if req_qty is None:
            req_qty = compute_required_qty(bl.quantity, version.build_quantity, bl.dnp)
        req_f = float(req_qty or 0)
        override = overrides.get(bl.id)
        dnp = is_dnp_line(bl)
        sel = resolve_line_selection(
            bl=bl,
            req_qty=req_f,
            results_map=results_map,
            override=override,
            priority=priority,
            dnp=dnp,
        )

        offers = []
        for s in priority:
            offer = _offer_from_result(_result_for_supplier(results_map, bl.id, s), req_qty=req_f)
            if offer:
                offers.append(offer)

        lines.append(
            {
                "bom_line_id": bl.id,
                "line_no": bl.line_no,
                "mpn": bl.mpn,
                "cleaned_mpn": bl.cleaned_mpn,
                "search_mpn": _search_mpn_for_line(bl, override),
                "search_mpn_override": override.search_mpn_override if override else None,
                "search_mpn_override_active": bool(override and override.search_mpn_override),
                "manufacturer": bl.manufacturer,
                "description": bl.description,
                "required_qty": req_f,
                "dnp": dnp,
                "source": sel.source,
                "supplier_part_number": sel.supplier_pn,
                "unit_price": sel.unit_price,
                "extended_price": sel.extended_price,
                "stock": sel.stock,
                "currency": sel.currency,
                "lead_time": sel.lead_time,
                "status": sel.status,
                "solution_status": sel.solution_status,
                "notes": sel.notes,
                "selected_supplier": sel.selected_supplier,
                "selected_source_type": sel.selected_source_type,
                "user_selected": bool(override and override.user_selected),
                "offers": offers,
            }
        )

        summary["total_lines"] += 1
        if sel.solution_status == SOLUTION_HAS:
            summary["has_solution"] += 1
        elif sel.solution_status == SOLUTION_NEEDS_APPROVAL:
            summary["needs_approval"] += 1
        elif sel.solution_status == SOLUTION_NO:
            summary["no_solution"] += 1
        elif sel.solution_status == SOLUTION_DNP:
            summary["dnp"] += 1
        if sel.extended_price:
            summary["selected_total_cost"] += float(sel.extended_price)

    return {"lines": lines, "summary": summary}


def select_line_offer(
    db: Session,
    *,
    project_id: int,
    bom_version_id: int,
    bom_line_id: int,
    offer_type: str,
    supplier: str | None = None,
    manually_approved_possible_match: bool = False,
    user_id: int | None,
) -> dict:
    override = _get_or_create_override(
        db,
        project_id=project_id,
        bom_version_id=bom_version_id,
        bom_line_id=bom_line_id,
        user_id=user_id,
    )
    override.user_selected = True
    override.updated_by_user_id = user_id
    override.manually_approved_possible_match = manually_approved_possible_match

    if offer_type == SOURCE_TYPE_DNP:
        override.selected_source_type = SOURCE_TYPE_DNP
        override.selected_supplier = None
    elif offer_type == SOURCE_TYPE_TBD:
        override.selected_source_type = SOURCE_TYPE_TBD
        override.selected_supplier = None
    elif offer_type == SOURCE_TYPE_SUPPLIER:
        if not supplier:
            raise ValueError("supplier required")
        override.selected_source_type = SOURCE_TYPE_SUPPLIER
        override.selected_supplier = supplier
    else:
        raise ValueError(f"Unknown offer_type: {offer_type}")

    db.commit()
    return get_workbench_line(db, project_id=project_id, bom_version_id=bom_version_id, bom_line_id=bom_line_id)


def save_manual_source(
    db: Session,
    *,
    project_id: int,
    bom_version_id: int,
    bom_line_id: int,
    supplier_name: str,
    supplier_part_number: str | None,
    unit_price: float,
    currency: str = "USD",
    stock: float | None = None,
    lead_time: str | None = None,
    note: str | None = None,
    user_id: int | None,
) -> dict:
    override = _get_or_create_override(
        db,
        project_id=project_id,
        bom_version_id=bom_version_id,
        bom_line_id=bom_line_id,
        user_id=user_id,
    )
    override.user_selected = True
    override.selected_source_type = SOURCE_TYPE_MANUAL
    override.selected_supplier = None
    override.manual_supplier_name = supplier_name
    override.manual_supplier_part_number = supplier_part_number
    override.manual_unit_price = unit_price
    override.manual_currency = currency
    override.manual_stock = stock
    override.manual_lead_time = lead_time
    override.note = note
    override.updated_by_user_id = user_id
    db.commit()
    return get_workbench_line(db, project_id=project_id, bom_version_id=bom_version_id, bom_line_id=bom_line_id)


def save_mpn_override(
    db: Session,
    *,
    project_id: int,
    bom_version_id: int,
    bom_line_id: int,
    search_mpn_override: str | None,
    user_id: int | None,
) -> dict:
    override = _get_or_create_override(
        db,
        project_id=project_id,
        bom_version_id=bom_version_id,
        bom_line_id=bom_line_id,
        user_id=user_id,
    )
    override.search_mpn_override = search_mpn_override.strip() if search_mpn_override else None
    override.updated_by_user_id = user_id
    db.commit()
    return get_workbench_line(db, project_id=project_id, bom_version_id=bom_version_id, bom_line_id=bom_line_id)


def get_workbench_line(
    db: Session, *, project_id: int, bom_version_id: int, bom_line_id: int
) -> dict:
    data = get_workbench_results(
        db, project_id=project_id, bom_version_id=bom_version_id
    )
    for ln in data["lines"]:
        if ln["bom_line_id"] == bom_line_id:
            return ln
    raise ValueError("BOM line not found")


def fetch_single_line(
    db: Session,
    *,
    project_id: int,
    bom_version_id: int,
    bom_line_id: int,
    suppliers: list[str],
    user_id: int | None,
    settings: Settings | None = None,
) -> dict:
    settings = settings or get_settings()
    version = db.get(BomVersion, bom_version_id)
    if version is None or version.project_id != project_id:
        raise ValueError("BOM version not found")
    bl = db.get(BomLine, bom_line_id)
    if bl is None or bl.bom_version_id != bom_version_id:
        raise ValueError("BOM line not found")

    valid = [s for s in suppliers if s in (SUPPLIER_DIGIKEY, SUPPLIER_MOUSER)]
    if not valid:
        raise ValueError("No valid suppliers")

    override = db.scalar(
        select(OfficialPricingLineOverride).where(
            OfficialPricingLineOverride.project_id == project_id,
            OfficialPricingLineOverride.bom_version_id == bom_version_id,
            OfficialPricingLineOverride.bom_line_id == bom_line_id,
        )
    )
    mpn = _search_mpn_for_line(bl, override)
    req_qty = bl.required_qty
    if req_qty is None:
        req_qty = compute_required_qty(bl.quantity, version.build_quantity, bl.dnp)

    is_mock = settings.supplier_api_mock
    for supplier in valid:
        if not settings.supplier_api_mock:
            client = _client_for_supplier(supplier, settings)
            if not client.credentials_configured():
                name = SUPPLIER_DISPLAY_NAMES.get(supplier, supplier)
                raise SupplierApiError(f"{name} API credentials missing", supplier=supplier)

        query = OfficialSupplierQuery(
            project_id=project_id,
            bom_version_id=bom_version_id,
            supplier=supplier,
            status="running",
            started_by_user_id=user_id,
            total_lines=1,
            is_mock=is_mock,
        )
        db.add(query)
        db.flush()
        client = _client_for_supplier(supplier, settings)
        try:
            result = client.search_by_mpn(mpn or "", float(req_qty or 0))
            save_supplier_result(
                db,
                query_id=query.id,
                bom_line_id=bl.id,
                supplier=supplier,
                original_mpn=mpn,
                required_qty=float(req_qty or 0),
                result=result,
            )
            query.status = "completed"
            query.matched_lines = 1 if result.unit_price_for_required_qty else 0
            query.completed_at = datetime.now(timezone.utc)
        except SupplierApiError as exc:
            save_supplier_result(
                db,
                query_id=query.id,
                bom_line_id=bl.id,
                supplier=supplier,
                original_mpn=mpn,
                required_qty=float(req_qty or 0),
                result=SupplierPriceResult(
                    supplier=supplier,
                    mpn=mpn or "",
                    match_status="error",
                    match_reason=exc.message,
                ),
            )
            query.status = "failed"
            query.error_message = exc.message
            query.completed_at = datetime.now(timezone.utc)

    log_activity(
        db,
        user_id=user_id,
        action_type="official_pricing_line_refetch",
        project_id=project_id,
        entity_type="bom_line",
        entity_name=mpn or str(bom_line_id),
        change_summary=f"Re-fetched supplier pricing for line {bom_line_id}",
        commit=False,
    )
    db.commit()
    return get_workbench_line(
        db, project_id=project_id, bom_version_id=bom_version_id, bom_line_id=bom_line_id
    )


def clear_user_selection(
    db: Session,
    *,
    project_id: int,
    bom_version_id: int,
    bom_line_id: int,
    user_id: int | None,
) -> dict:
    override = db.scalar(
        select(OfficialPricingLineOverride).where(
            OfficialPricingLineOverride.project_id == project_id,
            OfficialPricingLineOverride.bom_version_id == bom_version_id,
            OfficialPricingLineOverride.bom_line_id == bom_line_id,
        )
    )
    if override:
        override.user_selected = False
        override.selected_source_type = None
        override.selected_supplier = None
        override.manually_approved_possible_match = False
        override.updated_by_user_id = user_id
        db.commit()
    return get_workbench_line(
        db, project_id=project_id, bom_version_id=bom_version_id, bom_line_id=bom_line_id
    )
