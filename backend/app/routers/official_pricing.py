"""Official supplier API pricing endpoints (Digi-Key, Mouser)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user_id
from app.models import OfficialPriceLine, OfficialPriceSnapshot
from app.schemas.official_pricing import (
    OfficialPriceLineRead,
    OfficialPriceSnapshotRead,
    OfficialPricingFetchRequest,
    OfficialPricingFetchResponse,
    OfficialPricingLineResult,
    OfficialPricingResultsResponse,
    OfficialSnapshotCreateRequest,
    OfficialSnapshotCreateResponse,
    SupplierConfigStatus,
    SupplierResultCell,
    SupplierTestRequest,
    SupplierTestResponse,
)
from app.services.suppliers.base import SupplierApiError
from app.services.suppliers.official_pricing import (
    create_official_snapshot,
    fetch_official_pricing,
    get_official_results,
    supplier_config_status,
    test_supplier_search,
)

router = APIRouter(prefix="/official-pricing", tags=["official-pricing"])


@router.get("/status", response_model=SupplierConfigStatus)
def get_supplier_status() -> SupplierConfigStatus:
    return SupplierConfigStatus(**supplier_config_status(get_settings()))


@router.post("/test-supplier", response_model=SupplierTestResponse)
def post_test_supplier(payload: SupplierTestRequest) -> SupplierTestResponse:
    try:
        result = test_supplier_search(
            supplier=payload.supplier,
            mpn=payload.mpn,
            required_qty=payload.required_qty,
        )
        return SupplierTestResponse(**result)
    except SupplierApiError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/fetch", response_model=OfficialPricingFetchResponse)
def post_fetch_official_pricing(
    payload: OfficialPricingFetchRequest,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> OfficialPricingFetchResponse:
    try:
        result = fetch_official_pricing(
            db,
            project_id=payload.project_id,
            bom_version_id=payload.bom_version_id,
            suppliers=payload.suppliers,
            mode=payload.mode,
            user_id=user_id,
        )
        return OfficialPricingFetchResponse(**result)
    except SupplierApiError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/results", response_model=OfficialPricingResultsResponse)
def get_results(
    project_id: int = Query(...),
    bom_version_id: int = Query(...),
    db: Session = Depends(get_db),
) -> OfficialPricingResultsResponse:
    try:
        rows = get_official_results(
            db, project_id=project_id, bom_version_id=bom_version_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    lines = []
    for row in rows:
        dk = row.get("digikey")
        ms = row.get("mouser")
        lines.append(
            OfficialPricingLineResult(
                bom_line_id=row["bom_line_id"],
                line_no=row["line_no"],
                mpn=row["mpn"],
                cleaned_mpn=row["cleaned_mpn"],
                manufacturer=row["manufacturer"],
                required_qty=row["required_qty"],
                dnp=row["dnp"],
                digikey=SupplierResultCell(**dk) if dk else None,
                mouser=SupplierResultCell(**ms) if ms else None,
                selected_official_source=row.get("selected_official_source"),
            )
        )

    return OfficialPricingResultsResponse(
        project_id=project_id,
        bom_version_id=bom_version_id,
        config=SupplierConfigStatus(**supplier_config_status(get_settings())),
        lines=lines,
    )


@router.post("/create-snapshot", response_model=OfficialSnapshotCreateResponse)
def post_create_snapshot(
    payload: OfficialSnapshotCreateRequest,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> OfficialSnapshotCreateResponse:
    try:
        result = create_official_snapshot(
            db,
            project_id=payload.project_id,
            bom_version_id=payload.bom_version_id,
            snapshot_name=payload.snapshot_name,
            supplier_priority=payload.supplier_priority,
            user_id=user_id,
        )
        return OfficialSnapshotCreateResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/snapshots/{snapshot_id}", response_model=OfficialPriceSnapshotRead)
def get_snapshot(
    snapshot_id: int,
    db: Session = Depends(get_db),
) -> OfficialPriceSnapshotRead:
    snapshot = db.get(OfficialPriceSnapshot, snapshot_id)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    lines = list(
        db.scalars(
            select(OfficialPriceLine)
            .where(OfficialPriceLine.snapshot_id == snapshot_id)
            .order_by(OfficialPriceLine.id)
        )
    )

    return OfficialPriceSnapshotRead(
        id=snapshot.id,
        project_id=snapshot.project_id,
        bom_version_id=snapshot.bom_version_id,
        snapshot_name=snapshot.snapshot_name,
        created_by_user_id=snapshot.created_by_user_id,
        created_at=snapshot.created_at,
        status=snapshot.status,
        is_mock=snapshot.is_mock,
        lines=[OfficialPriceLineRead.model_validate(ln) for ln in lines],
    )
