"""Official supplier API pricing endpoints (Digi-Key, Mouser, TI)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user_id
from app.models import OfficialPriceLine, OfficialPriceSnapshot
from app.schemas.component_lookup import (
    ComponentLookupAddToProjectRequest,
    ComponentLookupAddToProjectResponse,
    ComponentLookupCreateRequest,
    ComponentLookupListResponse,
    ComponentLookupRead,
    ComponentLookupRefreshRequest,
    ComponentLookupSummary,
    MpnCrossReferences,
)
from app.schemas.official_pricing import (
    FetchLineRequest,
    ManualSourceRequest,
    MpnOverrideRequest,
    OfficialPriceLineRead,
    OfficialPriceSnapshotRead,
    OfficialPricingFetchRequest,
    OfficialPricingFetchResponse,
    OfficialPricingLineResult,
    OfficialPricingResultsResponse,
    OfficialSnapshotCreateRequest,
    OfficialSnapshotCreateResponse,
    EastQuoteUploadResult,
    IncludeEastPricingRequest,
    SelectOfferRequest,
    SupplierConfigStatus,
    SupplierOffer,
    SupplierResultCell,
    SupplierTestRequest,
    SupplierTestResponse,
    WorkbenchExportRequest,
    PricingComparison,
    WorkbenchLineResult,
    WorkbenchResultsResponse,
    WorkbenchSummary,
)
from app.services.suppliers.base import SupplierApiError
from app.services.suppliers.component_lookup import (
    add_component_lookup_to_project,
    create_component_lookup,
    get_component_lookup,
    list_component_lookups,
    get_mpn_context,
    refresh_component_lookup,
)
from app.services.suppliers.official_pricing import (
    create_official_snapshot,
    fetch_official_pricing,
    get_official_results,
    supplier_config_status,
    test_supplier_search,
)
from app.services.suppliers.workbench import (
    clear_user_selection,
    fetch_single_line,
    get_workbench_results,
    save_manual_source,
    save_mpn_override,
    select_line_offer,
)
from app.services.east_quotes.service import (
    archive_east_quote,
    list_east_quotes,
    set_active_quote,
    set_include_east_pricing,
    upload_east_quote,
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


@router.get("/component-lookups", response_model=ComponentLookupListResponse)
def get_component_lookups(
    q: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> ComponentLookupListResponse:
    data = list_component_lookups(db, q=q, limit=limit, offset=offset)
    return ComponentLookupListResponse(
        items=[ComponentLookupSummary(**row) for row in data["items"]],
        offset=data["offset"],
        limit=data["limit"],
        has_more=data["has_more"],
    )


@router.get("/component-lookups/mpn-context", response_model=MpnCrossReferences)
def get_component_lookup_mpn_context(
    mpn: str = Query(..., min_length=1),
    exclude_lookup_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
) -> MpnCrossReferences:
    return MpnCrossReferences(**get_mpn_context(db, mpn=mpn, exclude_lookup_id=exclude_lookup_id))


@router.get("/component-lookups/{lookup_id}", response_model=ComponentLookupRead)
def get_component_lookup_by_id(
    lookup_id: int,
    db: Session = Depends(get_db),
) -> ComponentLookupRead:
    try:
        return ComponentLookupRead(**get_component_lookup(db, lookup_id))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/component-lookups", response_model=ComponentLookupRead)
def post_component_lookup(
    payload: ComponentLookupCreateRequest,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> ComponentLookupRead:
    try:
        row = create_component_lookup(
            db,
            mpn=payload.mpn,
            required_qty=payload.required_qty,
            manufacturer_hint=payload.manufacturer_hint,
            note=payload.note,
            suppliers=payload.suppliers,
            user_id=user_id,
        )
        return ComponentLookupRead(**row)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/component-lookups/{lookup_id}/refresh", response_model=ComponentLookupRead)
def post_component_lookup_refresh(
    lookup_id: int,
    payload: ComponentLookupRefreshRequest,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> ComponentLookupRead:
    try:
        row = refresh_component_lookup(
            db,
            lookup_id=lookup_id,
            suppliers=payload.suppliers,
            user_id=user_id,
        )
        return ComponentLookupRead(**row)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post(
    "/component-lookups/{lookup_id}/add-to-project",
    response_model=ComponentLookupAddToProjectResponse,
)
def post_component_lookup_add_to_project(
    lookup_id: int,
    payload: ComponentLookupAddToProjectRequest,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> ComponentLookupAddToProjectResponse:
    try:
        row = add_component_lookup_to_project(
            db,
            lookup_id=lookup_id,
            project_id=payload.project_id,
            bom_version_id=payload.bom_version_id,
            quantity_per_assembly=payload.quantity_per_assembly,
            reference_designators=payload.reference_designators,
            notes=payload.notes,
            preferred_supplier=payload.preferred_supplier,
            user_id=user_id,
        )
        return ComponentLookupAddToProjectResponse(**row)
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
        ti = row.get("ti")
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
                ti=SupplierResultCell(**ti) if ti else None,
                selected_official_source=row.get("selected_official_source"),
            )
        )

    return OfficialPricingResultsResponse(
        project_id=project_id,
        bom_version_id=bom_version_id,
        config=SupplierConfigStatus(**supplier_config_status(get_settings())),
        lines=lines,
    )


@router.get("/workbench", response_model=WorkbenchResultsResponse)
def get_workbench(
    project_id: int = Query(...),
    bom_version_id: int = Query(...),
    db: Session = Depends(get_db),
) -> WorkbenchResultsResponse:
    try:
        data = get_workbench_results(
            db, project_id=project_id, bom_version_id=bom_version_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return WorkbenchResultsResponse(
        project_id=project_id,
        bom_version_id=bom_version_id,
        config=SupplierConfigStatus(**supplier_config_status(get_settings())),
        summary=WorkbenchSummary(**data["summary"]),
        lines=[WorkbenchLineResult(**ln) for ln in data["lines"]],
        include_east_pricing=data.get("include_east_pricing", False),
        east_quotes=data.get("east_quotes", []),
        pricing_comparison=(
            PricingComparison(**data["pricing_comparison"])
            if data.get("pricing_comparison")
            else None
        ),
    )


@router.post("/workbench/select", response_model=WorkbenchLineResult)
def post_select_offer(
    payload: SelectOfferRequest,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> WorkbenchLineResult:
    try:
        row = select_line_offer(
            db,
            project_id=payload.project_id,
            bom_version_id=payload.bom_version_id,
            bom_line_id=payload.bom_line_id,
            offer_type=payload.offer_type,
            supplier=payload.supplier,
            manually_approved_possible_match=payload.manually_approved_possible_match,
            user_id=user_id,
        )
        return WorkbenchLineResult(**row)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/workbench/manual", response_model=WorkbenchLineResult)
def post_manual_source(
    payload: ManualSourceRequest,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> WorkbenchLineResult:
    try:
        row = save_manual_source(
            db,
            project_id=payload.project_id,
            bom_version_id=payload.bom_version_id,
            bom_line_id=payload.bom_line_id,
            supplier_name=payload.supplier_name,
            supplier_part_number=payload.supplier_part_number,
            unit_price=payload.unit_price,
            currency=payload.currency,
            stock=payload.stock,
            lead_time=payload.lead_time,
            note=payload.note,
            user_id=user_id,
        )
        return WorkbenchLineResult(**row)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/workbench/mpn-override", response_model=WorkbenchLineResult)
def patch_mpn_override(
    payload: MpnOverrideRequest,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> WorkbenchLineResult:
    try:
        row = save_mpn_override(
            db,
            project_id=payload.project_id,
            bom_version_id=payload.bom_version_id,
            bom_line_id=payload.bom_line_id,
            search_mpn_override=payload.search_mpn_override,
            user_id=user_id,
        )
        return WorkbenchLineResult(**row)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/workbench/fetch-line", response_model=WorkbenchLineResult)
def post_fetch_line(
    payload: FetchLineRequest,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> WorkbenchLineResult:
    try:
        row = fetch_single_line(
            db,
            project_id=payload.project_id,
            bom_version_id=payload.bom_version_id,
            bom_line_id=payload.bom_line_id,
            suppliers=payload.suppliers,
            user_id=user_id,
        )
        return WorkbenchLineResult(**row)
    except SupplierApiError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/workbench/reset-selection", response_model=WorkbenchLineResult)
def post_reset_selection(
    payload: SelectOfferRequest,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> WorkbenchLineResult:
    try:
        row = clear_user_selection(
            db,
            project_id=payload.project_id,
            bom_version_id=payload.bom_version_id,
            bom_line_id=payload.bom_line_id,
            user_id=user_id,
        )
        return WorkbenchLineResult(**row)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


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


@router.get("/east-quotes")
def get_east_quotes(
    project_id: int = Query(...),
    bom_version_id: int = Query(...),
    supplier_name: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[dict]:
    return list_east_quotes(
        db, project_id=project_id, bom_version_id=bom_version_id, supplier_name=supplier_name
    )


@router.post("/east-quotes/upload", response_model=EastQuoteUploadResult)
async def post_east_quote_upload(
    file: UploadFile = File(...),
    project_id: int = Form(...),
    bom_version_id: int = Form(...),
    supplier_name: str | None = Form(default=None),
    replace_existing: bool = Form(default=False),
    quote_id_to_replace: int | None = Form(default=None),
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> EastQuoteUploadResult:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="קובץ ריק")
    try:
        result = upload_east_quote(
            db,
            content=content,
            filename=file.filename or "east-quote.xlsx",
            project_id=project_id,
            bom_version_id=bom_version_id,
            supplier_name=supplier_name,
            replace_existing=replace_existing,
            quote_id_to_replace=quote_id_to_replace,
            user_id=user_id,
        )
        return EastQuoteUploadResult(**result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/east-quotes/{quote_id}/activate")
def patch_activate_east_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> dict:
    try:
        return set_active_quote(db, quote_id, user_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/east-quotes/{quote_id}")
def delete_east_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> dict:
    try:
        return archive_east_quote(db, quote_id, user_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/workbench/include-east-pricing")
def patch_include_east_pricing(
    payload: IncludeEastPricingRequest,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> dict:
    try:
        return set_include_east_pricing(
            db,
            bom_version_id=payload.bom_version_id,
            include=payload.include_east_pricing,
            user_id=user_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
