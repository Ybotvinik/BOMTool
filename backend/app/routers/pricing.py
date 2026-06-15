from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user_id
from app.models import (
    BomLine,
    BomVersion,
    PricingLine,
    PricingSnapshot,
    Project,
    SupplierQuote,
    SupplierQuoteLine,
)
from app.schemas.pricing import (
    PricingFromChinaQuote,
    PricingSnapshotRead,
    PricingSnapshotResult,
)
from app.services.activity import log_activity
from app.services.bom_quality import compute_required_qty

router = APIRouter(prefix="/pricing-snapshots", tags=["pricing"])
project_router = APIRouter(prefix="/projects", tags=["pricing"])


@router.post("/from-china-quote", response_model=PricingSnapshotResult)
def create_from_china_quote(
    payload: PricingFromChinaQuote,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> PricingSnapshotResult:
    project = db.get(Project, payload.project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="פרויקט לא נמצא")
    version = db.get(BomVersion, payload.bom_version_id)
    if version is None:
        raise HTTPException(status_code=404, detail="גרסת BOM לא נמצאה")
    quote = db.get(SupplierQuote, payload.supplier_quote_id)
    if quote is None:
        raise HTTPException(status_code=404, detail="הצעת מחיר לא נמצאה")

    # Map matched BOM line id -> quote line (first match wins).
    q_lines = list(
        db.scalars(
            select(SupplierQuoteLine).where(
                SupplierQuoteLine.supplier_quote_id == quote.id
            )
        )
    )
    by_bom: dict[int, SupplierQuoteLine] = {}
    for ql in q_lines:
        if ql.matched_bom_line_id is not None and ql.matched_bom_line_id not in by_bom:
            by_bom[ql.matched_bom_line_id] = ql

    bom_lines = list(
        db.scalars(
            select(BomLine)
            .where(BomLine.bom_version_id == payload.bom_version_id)
            .order_by(BomLine.line_no, BomLine.id)
        )
    )

    snapshot = PricingSnapshot(
        project_id=payload.project_id,
        bom_version_id=payload.bom_version_id,
        name=payload.snapshot_name or f"China Quote - {quote.quote_name or quote.id}",
        snapshot_name=payload.snapshot_name or f"China Quote - {quote.quote_name or quote.id}",
        source_type="china_quote",
        supplier_quote_id=quote.id,
        currency=quote.currency or "USD",
        status="Active",
        created_by_id=user_id,
        created_by_user_id=user_id,
    )
    db.add(snapshot)
    db.flush()

    priced = missing = needs_review = 0
    total = Decimal(0)
    for bl in bom_lines:
        req_qty = bl.required_qty
        if req_qty is None:
            req_qty = compute_required_qty(bl.quantity, version.build_quantity, bl.dnp)

        unit_cost: Decimal | None = None
        extended = Decimal(0)
        source_quote_line_id = None
        confidence = None
        status = "missing_price"

        if bl.dnp:
            unit_cost = Decimal(0)
            extended = Decimal(0)
            status = "priced"
            priced += 1
        else:
            ql = by_bom.get(bl.id)
            if ql is not None and ql.unit_price is not None:
                unit_cost = Decimal(str(ql.unit_price))
                source_quote_line_id = ql.id
                confidence = ql.match_confidence
                extended = unit_cost * Decimal(str(req_qty or 0))
                if (ql.match_confidence or 0) < 80:
                    status = "needs_review"
                    needs_review += 1
                else:
                    status = "priced"
                    priced += 1
                total += extended
            else:
                status = "missing_price"
                missing += 1

        db.add(
            PricingLine(
                pricing_snapshot_id=snapshot.id,
                bom_line_id=bl.id,
                source_quote_line_id=source_quote_line_id,
                mpn=bl.mpn,
                selected_source="china_quote" if source_quote_line_id else None,
                quantity=bl.quantity,
                required_qty=req_qty,
                unit_cost=unit_cost,
                internal_cost=unit_cost,
                extended_cost=extended,
                currency=quote.currency or "USD",
                match_confidence=confidence,
                pricing_status=status,
            )
        )

    log_activity(
        db,
        user_id=user_id,
        action_type="pricing_snapshot_created",
        project_id=payload.project_id,
        entity_type="pricing_snapshot",
        entity_name=snapshot.snapshot_name,
        change_summary=(
            f"Created pricing snapshot '{snapshot.snapshot_name}' from China quote "
            f"'{quote.quote_name}': total {float(total):.2f} {quote.currency}, "
            f"{priced} priced, {missing} missing, {needs_review} needs review"
        ),
        commit=False,
    )
    db.commit()

    return PricingSnapshotResult(
        pricing_snapshot_id=snapshot.id,
        priced_count=priced,
        missing_price_count=missing,
        needs_review_count=needs_review,
        total_internal_cost=float(total),
        currency=quote.currency or "USD",
    )


@router.get("/{pricing_snapshot_id}")
def get_snapshot(pricing_snapshot_id: int, db: Session = Depends(get_db)) -> dict:
    snap = db.get(PricingSnapshot, pricing_snapshot_id)
    if snap is None:
        raise HTTPException(status_code=404, detail="Pricing snapshot לא נמצא")
    lines = list(
        db.scalars(
            select(PricingLine)
            .where(PricingLine.pricing_snapshot_id == pricing_snapshot_id)
            .order_by(PricingLine.id)
        )
    )
    total = sum((float(l.extended_cost or 0) for l in lines))
    priced = sum(1 for l in lines if l.pricing_status == "priced")
    missing = sum(1 for l in lines if l.pricing_status == "missing_price")
    needs = sum(1 for l in lines if l.pricing_status == "needs_review")
    return {
        "id": snap.id,
        "project_id": snap.project_id,
        "bom_version_id": snap.bom_version_id,
        "snapshot_name": snap.snapshot_name or snap.name,
        "source_type": snap.source_type,
        "supplier_quote_id": snap.supplier_quote_id,
        "currency": snap.currency,
        "status": snap.status,
        "created_at": snap.created_at.isoformat() if snap.created_at else None,
        "total_internal_cost": total,
        "priced_count": priced,
        "missing_price_count": missing,
        "needs_review_count": needs,
        "lines": [
            {
                "id": l.id,
                "bom_line_id": l.bom_line_id,
                "mpn": l.mpn,
                "selected_source": l.selected_source,
                "required_qty": float(l.required_qty) if l.required_qty is not None else None,
                "unit_cost": float(l.unit_cost) if l.unit_cost is not None else None,
                "extended_cost": float(l.extended_cost) if l.extended_cost is not None else None,
                "currency": l.currency,
                "match_confidence": l.match_confidence,
                "pricing_status": l.pricing_status,
            }
            for l in lines
        ],
    }


@project_router.get("/{project_id}/pricing-snapshots", response_model=list[PricingSnapshotRead])
def list_project_snapshots(project_id: int, db: Session = Depends(get_db)) -> list[PricingSnapshot]:
    return list(
        db.scalars(
            select(PricingSnapshot)
            .where(PricingSnapshot.project_id == project_id)
            .order_by(PricingSnapshot.id.desc())
        )
    )
