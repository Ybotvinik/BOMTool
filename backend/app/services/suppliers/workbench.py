"""Supplier pricing workbench — selection, overrides, and row state."""

from __future__ import annotations

import logging
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
    INTERNAL_SUPPLIERS,
    OFFICIAL_API_SUPPLIERS,
    SOURCE_TYPE_EAST,
    SUPPLIER_DIGIKEY,
    SUPPLIER_DISPLAY_NAMES,
    SUPPLIER_LINK,
    SUPPLIER_MOUSER,
    SUPPLIER_TI,
    SupplierApiError,
    SupplierPriceResult,
    normalize_mpn,
)
from app.services.east_quotes.service import east_offers_by_bom_line, list_east_quotes
from app.services.suppliers.digikey import DigiKeyClient
from app.services.suppliers.mouser import MouserClient
from app.services.suppliers.ti import TIClient
from app.services.suppliers.pricing_store import (
    DEFAULT_SUPPLIER_PRIORITY,
    is_dnp_line,
    latest_results_by_line,
    save_supplier_result,
)

logger = logging.getLogger(__name__)

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
    if supplier == SUPPLIER_TI:
        return TIClient(settings)
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


def _is_exact_east_offer(offer: dict) -> bool:
    if offer.get("unit_price") is None:
        return False
    return bool(
        offer.get("is_exact_match")
        or offer.get("match_status") in ("exact_mpn", "matched", "designator_match")
    )


def _east_has_stock(offer: dict) -> bool:
    stock = offer.get("stock")
    if stock is not None and float(stock) == 0:
        return False
    return offer.get("unit_price") is not None


def _selection_from_east_offer(offer: dict, req_qty: float, *, notes: str | None = None) -> ResolvedSelection:
    unit = float(offer["unit_price"])
    stock = float(offer["stock"]) if offer.get("stock") is not None else None
    has_stock = _east_has_stock(offer)
    display = offer.get("supplier_display") or SUPPLIER_DISPLAY_NAMES.get(
        offer.get("supplier", ""), offer.get("supplier", "East")
    )
    ext = unit * req_qty
    is_possible = offer.get("match_status") in ("possible_match", "designator_match")
    if is_possible:
        status = STATUS_NEEDS_REVIEW
        solution = SOLUTION_NEEDS_APPROVAL
    else:
        status = STATUS_PRICED if has_stock else STATUS_NO_STOCK
        solution = SOLUTION_HAS if has_stock else SOLUTION_NEEDS_APPROVAL
    return ResolvedSelection(
        source=display,
        supplier_pn=offer.get("supplier_part_number"),
        unit_price=unit,
        extended_price=ext,
        stock=stock,
        currency=offer.get("currency") or "USD",
        lead_time=offer.get("lead_time"),
        status=status,
        solution_status=solution,
        notes=notes or offer.get("match_reason"),
        selected_supplier=offer.get("supplier"),
        selected_source_type=SOURCE_TYPE_EAST,
        price_break_qty=offer.get("price_break_qty"),
        match_status=offer.get("match_status"),
        match_reason=offer.get("match_reason"),
    )


def _auto_select_best(
    api_candidates: list[OfficialSupplierPriceResult | None],
    east_offers: list[dict],
    priority: list[str],
    *,
    include_east: bool,
) -> tuple[ResolvedSelection | None, str]:
    """Return best auto selection and kind: 'api' | 'east'."""
    exact_api = [c for c in api_candidates if _is_exact_result(c)]
    exact_east = [o for o in east_offers if include_east and _is_exact_east_offer(o)]

    def api_sort_key(r: OfficialSupplierPriceResult) -> tuple:
        has_stock = (r.available_qty or 0) > 0
        price = float(r.unit_price or 0)
        pri = priority.index(r.supplier) if r.supplier in priority else 99
        return (0 if has_stock else 1, price, pri)

    def east_sort_key(o: dict) -> tuple:
        has_stock = 0 if _east_has_stock(o) else 1
        price = float(o.get("unit_price") or 0)
        return (has_stock, price)

    best_api = sorted(exact_api, key=api_sort_key)[0] if exact_api else None
    best_east = sorted(exact_east, key=east_sort_key)[0] if exact_east else None

    if best_api and best_east:
        api_key = api_sort_key(best_api)
        east_key = east_sort_key(best_east)
        if east_key < api_key:
            return _selection_from_east_offer(best_east, 1.0), "east"  # req_qty applied by caller
        return None, "api"  # caller builds from api
    if best_east and not best_api:
        return _selection_from_east_offer(best_east, 1.0), "east"
    return None, "api" if best_api else "none"


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
    return "Manual"


def _is_manual_override(override: OfficialPricingLineOverride | None) -> bool:
    if override is None or override.manual_unit_price is None:
        return False
    if override.selected_source_type == SOURCE_TYPE_MANUAL:
        return True
    # Legacy rows: manual fields saved without selected_source_type=manual.
    return bool(
        override.user_selected
        and override.selected_source_type not in (SOURCE_TYPE_SUPPLIER, SOURCE_TYPE_TBD, SOURCE_TYPE_DNP)
    )


def _resolved_manual_selection(
    override: OfficialPricingLineOverride, req_qty: float
) -> ResolvedSelection:
    unit = float(override.manual_unit_price) if override.manual_unit_price is not None else None
    ext = unit * req_qty if unit is not None else None
    has_price = unit is not None
    note_parts = [p for p in [override.manual_supplier_name, override.note] if p]
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
        notes=" — ".join(note_parts) if note_parts else None,
        selected_supplier=None,
        selected_source_type=SOURCE_TYPE_MANUAL,
    )


def resolve_line_selection(
    *,
    bl: BomLine,
    req_qty: float,
    results_map: dict[tuple[int, str], OfficialSupplierPriceResult],
    override: OfficialPricingLineOverride | None,
    priority: list[str] | None = None,
    dnp: bool | None = None,
    east_offers: list[dict] | None = None,
    include_east: bool = False,
) -> ResolvedSelection:
    priority = priority or DEFAULT_SUPPLIER_PRIORITY
    east_offers = east_offers or []
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

    # Persisted manual override — always wins over auto-selection.
    if _is_manual_override(override):
        assert override is not None
        return _resolved_manual_selection(override, req_qty)

    if override and override.user_selected and override.selected_source_type == SOURCE_TYPE_DNP:
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
            notes=override.note or "DNP / Not populated",
            selected_supplier=None,
            selected_source_type=SOURCE_TYPE_DNP,
        )

    if override and override.user_selected:
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

        if (
            include_east
            and override.selected_source_type == SOURCE_TYPE_EAST
            and override.selected_supplier
        ):
            match = next(
                (o for o in east_offers if o.get("supplier") == override.selected_supplier),
                None,
            )
            if match and match.get("unit_price") is not None:
                sel = _selection_from_east_offer(match, req_qty, notes=override.note)
                if override.manually_approved_possible_match:
                    sel.manually_approved_possible_match = True
                return sel

    candidates = [_result_for_supplier(results_map, bl.id, s) for s in priority]
    east_sel, kind = _auto_select_best(candidates, east_offers, priority, include_east=include_east)
    if kind == "east" and east_sel is not None:
        east_sel.extended_price = (east_sel.unit_price or 0) * req_qty
        return east_sel

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


def _placeholder_api_offer(supplier: str) -> dict:
    return {
        "supplier": supplier,
        "supplier_display": SUPPLIER_DISPLAY_NAMES.get(supplier, supplier),
        "supplier_part_number": None,
        "manufacturer": None,
        "unit_price": None,
        "extended_price": None,
        "stock": None,
        "price_break_qty": None,
        "match_status": "not_fetched",
        "match_reason": "מחיר לא נמשך — ניתן למשוך ידנית מהמגירה",
        "is_exact_match": False,
        "product_url": None,
        "lead_time": None,
        "currency": "USD",
        "needs_review": False,
        "internal_only": False,
    }


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
        "internal_only": False,
    }


def _empty_scenario_stats() -> dict:
    return {
        "total": 0.0,
        "priced_lines": 0,
        "needs_approval": 0,
        "no_solution": 0,
        "no_stock": 0,
        "east_selected_lines": 0,
    }


def _accumulate_scenario(stats: dict, sel: ResolvedSelection) -> None:
    if sel.solution_status == SOLUTION_DNP:
        return
    if sel.solution_status == SOLUTION_NEEDS_APPROVAL:
        stats["needs_approval"] += 1
    elif sel.solution_status == SOLUTION_NO:
        stats["no_solution"] += 1
    if sel.status == STATUS_NO_STOCK:
        stats["no_stock"] += 1
    if sel.unit_price is not None and sel.source not in ("TBD", "DNP"):
        stats["priced_lines"] += 1
        stats["total"] += float(sel.extended_price or 0)
    if sel.selected_source_type == SOURCE_TYPE_EAST:
        stats["east_selected_lines"] += 1


def _offer_sort_key(offer: dict) -> tuple:
    stock = offer.get("stock")
    has_stock = (float(stock) > 0) if stock is not None else True
    return (0 if has_stock else 1, float(offer.get("unit_price") or 0))


def _is_exact_priced_offer(offer: dict, *, internal: bool) -> bool:
    if offer.get("unit_price") is None:
        return False
    if internal:
        return bool(
            offer.get("is_exact_match")
            or offer.get("match_status") in ("exact_mpn", "matched", "designator_match")
        )
    return bool(offer.get("is_exact_match") or offer.get("match_status") == "matched")


def _best_offer(offers: list[dict], *, internal: bool) -> dict | None:
    pool = [o for o in offers if bool(o.get("internal_only")) == internal]
    exact = [o for o in pool if _is_exact_priced_offer(o, internal=internal)]
    candidates = exact or [o for o in pool if o.get("unit_price") is not None]
    if not candidates:
        return None
    return sorted(candidates, key=_offer_sort_key)[0]


def _offer_key(offer: dict) -> str:
    return f"{offer.get('supplier')}:{offer.get('supplier_part_number') or ''}"


def _selection_matches_offer(sel: ResolvedSelection, offer: dict) -> bool:
    if offer.get("internal_only"):
        return (
            sel.selected_source_type == SOURCE_TYPE_EAST
            and sel.selected_supplier == offer.get("supplier")
        )
    return (
        sel.selected_source_type == SOURCE_TYPE_SUPPLIER
        and sel.selected_supplier == offer.get("supplier")
    )


def _recommended_offer(
    offers: list[dict], *, include_east: bool, official_best: dict | None, east_best: dict | None
) -> dict | None:
    if not include_east:
        return official_best
    if official_best and east_best:
        o_key = _offer_sort_key(official_best)
        e_key = _offer_sort_key(east_best)
        return east_best if e_key < o_key else official_best
    return east_best or official_best


def _enrich_offers(
    offers: list[dict],
    *,
    sel: ResolvedSelection,
    req_qty: float,
    include_east: bool,
    official_best: dict | None,
    recommended: dict | None,
) -> list[dict]:
    selected_ext = (
        float(sel.extended_price)
        if sel.unit_price is not None and sel.extended_price is not None
        else None
    )
    official_ext = (
        float(official_best["extended_price"])
        if official_best and official_best.get("extended_price") is not None
        else (
            float(official_best["unit_price"]) * req_qty
            if official_best and official_best.get("unit_price") is not None
            else None
        )
    )
    rec_key = _offer_key(recommended) if recommended else None
    out: list[dict] = []
    for o in offers:
        ext = o.get("extended_price")
        if ext is None and o.get("unit_price") is not None:
            ext = float(o["unit_price"]) * req_qty
        row = {**o, "extended_price": ext}
        row["is_currently_selected"] = _selection_matches_offer(sel, o)
        row["is_recommended"] = rec_key is not None and _offer_key(o) == rec_key
        if ext is not None and selected_ext is not None:
            row["delta_vs_selected"] = ext - selected_ext
        else:
            row["delta_vs_selected"] = None
        if ext is not None and official_ext is not None:
            row["delta_vs_official_best"] = ext - official_ext
            row["savings_vs_official"] = official_ext - ext
        else:
            row["delta_vs_official_best"] = None
            row["savings_vs_official"] = None
        if o.get("internal_only") and not include_east:
            row["disabled_in_current_mode"] = True
            row["disabled_reason"] = "כבוי במצב הנוכחי — זמין פנימי, לא משתתף במצב רשמי בלבד"
        else:
            row["disabled_in_current_mode"] = False
            row["disabled_reason"] = None
        out.append(row)
    return out


def _line_pricing_comparison(
    official_best: dict | None, east_best: dict | None, req_qty: float
) -> dict:
    def ext(o: dict | None) -> float | None:
        if o is None:
            return None
        if o.get("extended_price") is not None:
            return float(o["extended_price"])
        if o.get("unit_price") is not None:
            return float(o["unit_price"]) * req_qty
        return None

    o_ext = ext(official_best)
    e_ext = ext(east_best)
    diff = None
    pct = None
    if o_ext is not None and e_ext is not None:
        diff = o_ext - e_ext
        if o_ext > 0:
            pct = (diff / o_ext) * 100
    return {
        "official_best_extended": o_ext,
        "east_best_extended": e_ext,
        "difference": diff,
        "difference_percent": pct,
        "has_official_price": o_ext is not None,
        "has_east_price": e_ext is not None,
    }


def get_workbench_results(
    db: Session,
    *,
    project_id: int,
    bom_version_id: int,
    priority: list[str] | None = None,
    settings: Settings | None = None,
    include_east_override: bool | None = None,
) -> dict:
    settings = settings or get_settings()
    priority = priority or DEFAULT_SUPPLIER_PRIORITY
    version = db.get(BomVersion, bom_version_id)
    if version is None or version.project_id != project_id:
        raise ValueError("BOM version not found")

    include_east = (
        bool(include_east_override)
        if include_east_override is not None
        else bool(version.include_east_pricing)
    )
    east_by_line = east_offers_by_bom_line(
        db, project_id=project_id, bom_version_id=bom_version_id
    )

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
    official_stats = _empty_scenario_stats()
    with_east_stats = _empty_scenario_stats()

    for bl in bom_lines:
        req_qty = bl.required_qty
        if req_qty is None:
            req_qty = compute_required_qty(bl.quantity, version.build_quantity, bl.dnp)
        req_f = float(req_qty or 0)
        override = overrides.get(bl.id)
        dnp = is_dnp_line(bl)
        line_east = east_by_line.get(bl.id, [])

        sel_official = resolve_line_selection(
            bl=bl,
            req_qty=req_f,
            results_map=results_map,
            override=override,
            priority=priority,
            dnp=dnp,
            east_offers=line_east,
            include_east=False,
        )
        sel_with_east = resolve_line_selection(
            bl=bl,
            req_qty=req_f,
            results_map=results_map,
            override=override,
            priority=priority,
            dnp=dnp,
            east_offers=line_east,
            include_east=True,
        )
        sel = sel_with_east if include_east else sel_official

        _accumulate_scenario(official_stats, sel_official)
        _accumulate_scenario(with_east_stats, sel_with_east)

        offers_raw = []
        for s in priority:
            offer = _offer_from_result(_result_for_supplier(results_map, bl.id, s), req_qty=req_f)
            if offer:
                offers_raw.append(offer)
        seen_api = {o["supplier"] for o in offers_raw if not o.get("internal_only")}
        for s in priority:
            if s not in seen_api:
                offers_raw.append(_placeholder_api_offer(s))
        for eo in line_east:
            offers_raw.append(eo)

        official_best = _best_offer(offers_raw, internal=False)
        east_best = _best_offer(offers_raw, internal=True)
        recommended = _recommended_offer(
            offers_raw, include_east=include_east, official_best=official_best, east_best=east_best
        )
        offers = _enrich_offers(
            offers_raw,
            sel=sel,
            req_qty=req_f,
            include_east=include_east,
            official_best=official_best,
            recommended=recommended,
        )
        line_cmp = _line_pricing_comparison(official_best, east_best, req_f)

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
                "reference_designators": bl.reference_designators,
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
                "source_is_internal": sel.selected_source_type == SOURCE_TYPE_EAST,
                "east_pricing_disabled_note": (
                    "מחיר מזרח כבוי"
                    if (
                        not include_east
                        and override
                        and override.user_selected
                        and override.selected_source_type == SOURCE_TYPE_EAST
                    )
                    else None
                ),
                "line_pricing": line_cmp,
                "recommended_supplier": recommended.get("supplier_display") if recommended else None,
                "recommended_internal_only": bool(recommended and recommended.get("internal_only")),
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
        if sel.extended_price and (
            include_east or sel.selected_source_type != SOURCE_TYPE_EAST
        ):
            summary["selected_total_cost"] += float(sel.extended_price)

    off_total = official_stats["total"]
    east_total = with_east_stats["total"]
    savings_amount = off_total - east_total
    savings_percent = (savings_amount / off_total * 100) if off_total > 0 else None

    return {
        "lines": lines,
        "summary": summary,
        "include_east_pricing": include_east,
        "east_quotes": list_east_quotes(
            db, project_id=project_id, bom_version_id=bom_version_id
        ),
        "pricing_comparison": {
            "official_only": official_stats,
            "with_east": with_east_stats,
            "savings": {
                "amount": savings_amount,
                "percent": savings_percent,
                "is_saving": savings_amount > 0,
            },
        },
    }


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
    elif offer_type == SOURCE_TYPE_EAST:
        if not supplier:
            raise ValueError("supplier required")
        override.selected_source_type = SOURCE_TYPE_EAST
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
    name = (supplier_name or "").strip()
    if not name:
        raise ValueError("supplier_name is required")
    if unit_price is None or unit_price < 0:
        raise ValueError("unit_price must be a non-negative number")

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
    override.selected_supplier_part_number = None
    override.manually_approved_possible_match = False
    override.manual_supplier_name = name
    override.manual_supplier_part_number = (supplier_part_number or "").strip() or None
    override.manual_unit_price = unit_price
    override.manual_currency = currency or "USD"
    override.manual_stock = stock
    override.manual_lead_time = (lead_time or "").strip() or None
    override.note = (note or "").strip() or None
    override.updated_by_user_id = user_id
    db.commit()
    db.expire_all()

    log_activity(
        db,
        user_id=user_id,
        action_type="official_pricing_manual_source",
        project_id=project_id,
        entity_type="bom_line",
        entity_name=name,
        change_summary=(
            f"Manual supplier source for line {bom_line_id}: {name} @ {unit_price} {currency or 'USD'}"
        ),
        commit=True,
    )
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

    valid = [s for s in suppliers if s in OFFICIAL_API_SUPPLIERS]
    if not valid:
        raise ValueError("No valid suppliers")

    fetch_suppliers: list[str] = []
    for supplier in valid:
        if settings.supplier_api_mock:
            fetch_suppliers.append(supplier)
            continue
        client = _client_for_supplier(supplier, settings)
        if client.credentials_configured():
            fetch_suppliers.append(supplier)
        else:
            logger.warning(
                "%s skipped for line refetch — credentials missing",
                SUPPLIER_DISPLAY_NAMES.get(supplier, supplier),
            )

    if not fetch_suppliers and not settings.supplier_api_mock:
        raise SupplierApiError("No configured suppliers available for fetch", supplier=None)

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
    for supplier in fetch_suppliers:
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
