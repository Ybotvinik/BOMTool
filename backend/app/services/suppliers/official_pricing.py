"""Orchestration for official supplier API pricing fetch and snapshots."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.models import (
    BomLine,
    BomVersion,
    OfficialPriceLine,
    OfficialPriceSnapshot,
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
    supplier_result_to_dict,
)
from app.services.suppliers.pricing_store import (
    DEFAULT_SUPPLIER_PRIORITY,
    is_dnp_line,
    latest_results_by_line,
    save_supplier_result,
)
from app.services.suppliers.digikey import DigiKeyClient
from app.services.suppliers.mouser import MouserClient
from app.services.suppliers.workbench import (
    _overrides_by_line,
    _search_mpn_for_line,
    resolve_line_selection,
)

logger = logging.getLogger(__name__)

_is_dnp_line = is_dnp_line
_latest_results_by_line = latest_results_by_line
_save_result = save_supplier_result


def supplier_config_status(settings: Settings | None = None) -> dict:
    settings = settings or get_settings()
    mock = settings.supplier_api_mock

    def _supplier_block(configured: bool) -> dict:
        if mock:
            mode = "mock"
        elif configured:
            mode = "real_api"
        else:
            mode = "credentials_missing"
        return {
            "configured": configured and not mock,
            "credentials_missing": not configured and not mock,
            "mode": mode,
        }

    return {
        "digikey": {
            **_supplier_block(settings.digikey_configured),
            "env": settings.digikey_env,
        },
        "mouser": _supplier_block(settings.mouser_configured),
        "mock_mode": mock,
        "mock_allow_export": settings.supplier_api_mock_allow_export,
    }


def test_supplier_search(
    *,
    supplier: str,
    mpn: str,
    required_qty: float,
    settings: Settings | None = None,
) -> dict:
    """Single MPN lookup for debugging — uses real API unless SUPPLIER_API_MOCK=true."""
    settings = settings or get_settings()
    if supplier not in (SUPPLIER_DIGIKEY, SUPPLIER_MOUSER):
        raise ValueError(f"Unknown supplier: {supplier}")

    if not settings.supplier_api_mock:
        client = _client_for_supplier(supplier, settings)
        if not client.credentials_configured():
            name = SUPPLIER_DISPLAY_NAMES.get(supplier, supplier)
            raise SupplierApiError(
                f"{name} API credentials missing",
                supplier=supplier,
            )

    client = _client_for_supplier(supplier, settings)
    result = client.search_by_mpn(mpn, required_qty)
    is_mock = settings.supplier_api_mock or (
        result.match_reason == "mock_response"
    )
    return supplier_result_to_dict(result, is_mock=is_mock)


def _client_for_supplier(supplier: str, settings: Settings):
    if supplier == SUPPLIER_DIGIKEY:
        return DigiKeyClient(settings)
    if supplier == SUPPLIER_MOUSER:
        return MouserClient(settings)
    raise ValueError(f"Unknown supplier: {supplier}")


def _is_dnp_line(line: BomLine) -> bool:
    if line.dnp:
        return True
    if line.required_qty is not None and float(line.required_qty) == 0:
        return True
    return False


def _save_result(
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


def fetch_official_pricing(
    db: Session,
    *,
    project_id: int,
    bom_version_id: int,
    suppliers: list[str],
    mode: str,
    user_id: int | None,
    settings: Settings | None = None,
) -> dict:
    settings = settings or get_settings()
    project = db.get(Project, project_id)
    if project is None:
        raise ValueError("Project not found")
    version = db.get(BomVersion, bom_version_id)
    if version is None or version.project_id != project_id:
        raise ValueError("BOM version not found")

    valid_suppliers = [s for s in suppliers if s in (SUPPLIER_DIGIKEY, SUPPLIER_MOUSER)]
    if not valid_suppliers:
        raise ValueError("No valid suppliers selected")

    fetch_suppliers: list[str] = []
    skipped_suppliers: list[str] = []
    for s in valid_suppliers:
        if settings.supplier_api_mock:
            fetch_suppliers.append(s)
            continue
        client = _client_for_supplier(s, settings)
        if client.credentials_configured():
            fetch_suppliers.append(s)
        else:
            name = SUPPLIER_DISPLAY_NAMES.get(s, s)
            skipped_suppliers.append(name)
            logger.warning("%s skipped — API credentials missing", name)

    if not fetch_suppliers and not settings.supplier_api_mock:
        if skipped_suppliers:
            raise SupplierApiError(
                f"No supplier credentials configured for: {', '.join(skipped_suppliers)}",
                supplier=None,
            )
        raise ValueError("No suppliers available to fetch")

    bom_lines = list(
        db.scalars(
            select(BomLine)
            .where(BomLine.bom_version_id == bom_version_id)
            .order_by(BomLine.line_no, BomLine.id)
        )
    )
    active_lines = [bl for bl in bom_lines if not _is_dnp_line(bl)]

    overrides = _overrides_by_line(db, project_id, bom_version_id)

    if mode == "missing_only":
        existing = _latest_results_by_line(db, bom_version_id, fetch_suppliers, settings=settings)
        lines_to_fetch = []
        for bl in active_lines:
            has_price = any(
                existing.get((bl.id, s)) and existing[(bl.id, s)].unit_price is not None
                for s in fetch_suppliers
            )
            if not has_price:
                lines_to_fetch.append(bl)
    else:
        lines_to_fetch = active_lines

    log_activity(
        db,
        user_id=user_id,
        action_type="official_pricing_fetch_started",
        project_id=project_id,
        entity_type="bom_version",
        entity_name=version.version_name or version.version_label,
        change_summary=(
            f"Official pricing fetch started for suppliers {', '.join(fetch_suppliers)} "
            f"({len(lines_to_fetch)} lines)"
            + (
                f"; skipped (no credentials): {', '.join(skipped_suppliers)}"
                if skipped_suppliers
                else ""
            )
        ),
        commit=False,
    )

    query_ids: list[int] = []
    priced_count = 0
    missing_count = 0
    error_count = 0
    is_mock = settings.supplier_api_mock

    for supplier in fetch_suppliers:
        query = OfficialSupplierQuery(
            project_id=project_id,
            bom_version_id=bom_version_id,
            supplier=supplier,
            status="running",
            started_by_user_id=user_id,
            total_lines=len(lines_to_fetch),
            is_mock=is_mock,
        )
        db.add(query)
        db.flush()
        query_ids.append(query.id)

        matched = missing = errors = 0
        client = _client_for_supplier(supplier, settings)

        try:
            for bl in lines_to_fetch:
                req_qty = bl.required_qty
                if req_qty is None:
                    req_qty = compute_required_qty(
                        bl.quantity, version.build_quantity, bl.dnp
                    )
                ov = overrides.get(bl.id)
                mpn = _search_mpn_for_line(bl, ov)
                try:
                    result = client.search_by_mpn(mpn or "", float(req_qty or 0))
                    _save_result(
                        db,
                        query_id=query.id,
                        bom_line_id=bl.id,
                        supplier=supplier,
                        original_mpn=mpn,
                        required_qty=float(req_qty or 0),
                        result=result,
                    )
                    if result.match_status == "error":
                        errors += 1
                        error_count += 1
                    elif result.unit_price_for_required_qty is not None and result.match_status in (
                        "matched",
                        "possible_match",
                    ):
                        matched += 1
                        priced_count += 1
                    else:
                        missing += 1
                        missing_count += 1
                except SupplierApiError as exc:
                    _save_result(
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
                    errors += 1
                    error_count += 1

            query.status = "completed"
            query.matched_lines = matched
            query.missing_lines = missing
            query.completed_at = datetime.now(timezone.utc)
        except SupplierApiError as exc:
            query.status = "failed"
            query.error_message = exc.message
            query.completed_at = datetime.now(timezone.utc)
            db.commit()
            raise

    log_activity(
        db,
        user_id=user_id,
        action_type="official_pricing_fetch_completed",
        project_id=project_id,
        entity_type="bom_version",
        entity_name=version.version_name or version.version_label,
        change_summary=(
            f"Official pricing fetch completed: priced={priced_count}, "
            f"missing={missing_count}, errors={error_count}"
        ),
        commit=False,
    )
    db.commit()

    return {
        "query_ids": query_ids,
        "total_lines": len(lines_to_fetch),
        "priced_count": priced_count,
        "missing_count": missing_count,
        "error_count": error_count,
        "is_mock": is_mock,
    }


def _latest_results_by_line(
    db: Session,
    bom_version_id: int,
    suppliers: list[str] | None = None,
    settings: Settings | None = None,
) -> dict[tuple[int, str], OfficialSupplierPriceResult]:
    """Most recent result per (bom_line_id, supplier) for a BOM version."""
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


def get_official_results(
    db: Session,
    *,
    project_id: int,
    bom_version_id: int,
) -> list[dict]:
    settings = get_settings()
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
    results_map = _latest_results_by_line(db, bom_version_id, settings=settings)

    rows: list[dict] = []
    for bl in bom_lines:
        dk = results_map.get((bl.id, SUPPLIER_DIGIKEY))
        ms = results_map.get((bl.id, SUPPLIER_MOUSER))
        rows.append(
            {
                "bom_line_id": bl.id,
                "line_no": bl.line_no,
                "mpn": bl.mpn,
                "cleaned_mpn": bl.cleaned_mpn,
                "manufacturer": bl.manufacturer,
                "required_qty": float(bl.required_qty) if bl.required_qty is not None else None,
                "dnp": _is_dnp_line(bl),
                "digikey": _result_to_dict(dk),
                "mouser": _result_to_dict(ms),
                "selected_official_source": _pick_display_source(dk, ms),
            }
        )
    return rows


def _result_to_dict(row: OfficialSupplierPriceResult | None) -> dict | None:
    if row is None:
        return None
    return {
        "unit_price": float(row.unit_price) if row.unit_price is not None else None,
        "available_qty": float(row.available_qty) if row.available_qty is not None else None,
        "match_status": row.match_status,
        "is_exact_match": row.is_exact_match,
        "supplier_part_number": row.supplier_part_number,
        "lead_time": row.lead_time,
        "currency": row.currency,
    }


def _pick_display_source(
    dk: OfficialSupplierPriceResult | None,
    ms: OfficialSupplierPriceResult | None,
) -> str | None:
    best = _choose_best_result([dk, ms], DEFAULT_SUPPLIER_PRIORITY)
    if best is None:
        return None
    return SUPPLIER_DISPLAY_NAMES.get(best.supplier, best.supplier)


def _choose_best_result(
    candidates: list[OfficialSupplierPriceResult | None],
    priority: list[str],
) -> OfficialSupplierPriceResult | None:
    """Auto-select exact match only; possible_match excluded."""
    from app.services.suppliers.workbench import _auto_select_exact

    return _auto_select_exact(candidates, priority)


def create_official_snapshot(
    db: Session,
    *,
    project_id: int,
    bom_version_id: int,
    snapshot_name: str,
    supplier_priority: list[str] | None,
    user_id: int | None,
    settings: Settings | None = None,
) -> dict:
    settings = settings or get_settings()
    version = db.get(BomVersion, bom_version_id)
    if version is None or version.project_id != project_id:
        raise ValueError("BOM version not found")

    priority = supplier_priority or DEFAULT_SUPPLIER_PRIORITY
    results_map = _latest_results_by_line(db, bom_version_id, priority, settings=settings)
    overrides = _overrides_by_line(db, project_id, bom_version_id)
    is_mock = settings.supplier_api_mock

    snapshot = OfficialPriceSnapshot(
        project_id=project_id,
        bom_version_id=bom_version_id,
        snapshot_name=snapshot_name,
        created_by_user_id=user_id,
        status="Active",
        is_mock=is_mock,
    )
    db.add(snapshot)
    db.flush()

    bom_lines = list(
        db.scalars(
            select(BomLine)
            .where(BomLine.bom_version_id == bom_version_id)
            .order_by(BomLine.line_no, BomLine.id)
        )
    )

    priced = missing = needs_review = 0
    total = Decimal(0)

    for bl in bom_lines:
        req_qty = bl.required_qty
        if req_qty is None:
            req_qty = compute_required_qty(bl.quantity, version.build_quantity, bl.dnp)
        req_f = float(req_qty or 0)
        override = overrides.get(bl.id)
        sel = resolve_line_selection(
            bl=bl,
            req_qty=req_f,
            results_map=results_map,
            override=override,
            priority=priority,
            east_offers=[],
            include_east=False,
        )

        if sel.selected_source_type == "east_quote":
            sel = resolve_line_selection(
                bl=bl,
                req_qty=req_f,
                results_map=results_map,
                override=None,
                priority=priority,
                east_offers=[],
                include_east=False,
            )

        if sel.selected_source_type == "dnp":
            db.add(
                OfficialPriceLine(
                    snapshot_id=snapshot.id,
                    bom_line_id=bl.id,
                    official_source="DNP",
                    official_unit_price=None,
                    official_extended_price=Decimal(0),
                    required_qty=req_qty,
                    pricing_status="priced",
                    notes="DNP / Not populated",
                )
            )
            priced += 1
            continue

        if sel.unit_price is None or sel.source == "TBD":
            db.add(
                OfficialPriceLine(
                    snapshot_id=snapshot.id,
                    bom_line_id=bl.id,
                    required_qty=req_qty,
                    pricing_status="missing_price",
                    official_source="TBD",
                    notes=sel.notes,
                )
            )
            missing += 1
            continue

        unit = Decimal(str(sel.unit_price))
        extended = Decimal(str(sel.extended_price or 0))
        if sel.status in ("Needs Review", "No Stock") or sel.solution_status == "Needs Approval":
            snap_status = "needs_review"
            needs_review += 1
        else:
            snap_status = "priced"
            priced += 1
        total += extended

        avail = "in_stock" if (sel.stock or 0) > 0 else "unknown"
        note = sel.notes
        if sel.manually_approved_possible_match:
            note = f"manually approved possible_match; {note or ''}".strip()

        display_source = sel.source
        if sel.selected_source_type == "manual" and override and override.manual_supplier_name:
            display_source = override.manual_supplier_name
        elif display_source.startswith("Manual: "):
            display_source = display_source.replace("Manual: ", "", 1)

        db.add(
            OfficialPriceLine(
                snapshot_id=snapshot.id,
                bom_line_id=bl.id,
                selected_supplier=sel.selected_supplier,
                selected_supplier_part_number=sel.supplier_pn,
                official_source=display_source,
                official_unit_price=unit,
                official_extended_price=extended,
                required_qty=req_qty,
                availability_status=avail,
                lead_time=sel.lead_time,
                pricing_status=snap_status,
                notes=note,
            )
        )

    log_activity(
        db,
        user_id=user_id,
        action_type="official_price_snapshot_created",
        project_id=project_id,
        entity_type="official_price_snapshot",
        entity_name=snapshot_name,
        change_summary=(
            f"Official price snapshot '{snapshot_name}': priced={priced}, "
            f"missing={missing}, needs_review={needs_review}, total={total}"
        ),
        commit=False,
    )
    db.commit()

    return {
        "snapshot_id": snapshot.id,
        "priced_count": priced,
        "missing_price_count": missing,
        "needs_review_count": needs_review,
        "official_components_total": float(total),
        "is_mock": is_mock,
    }


def get_latest_exportable_snapshot(
    db: Session,
    bom_version_id: int,
    settings: Settings | None = None,
) -> OfficialPriceSnapshot | None:
    """Latest snapshot suitable for customer export."""
    settings = settings or get_settings()
    snapshots = list(
        db.scalars(
            select(OfficialPriceSnapshot)
            .where(
                OfficialPriceSnapshot.bom_version_id == bom_version_id,
                OfficialPriceSnapshot.status == "Active",
            )
            .order_by(desc(OfficialPriceSnapshot.created_at))
        )
    )
    for snap in snapshots:
        if snap.is_mock and not settings.supplier_api_mock_allow_export:
            continue
        return snap
    return None


def snapshot_lines_by_bom_line(
    db: Session, snapshot_id: int
) -> dict[int, OfficialPriceLine]:
    lines = list(
        db.scalars(
            select(OfficialPriceLine).where(OfficialPriceLine.snapshot_id == snapshot_id)
        )
    )
    return {ln.bom_line_id: ln for ln in lines}
