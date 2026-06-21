from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user_id
from app.models import BomLine, BomVersion, ExportReport, PricingSnapshot, Project
from app.services.activity import log_activity
from app.services.export_excel import (
    build_customer_bom_review_xlsx,
    build_internal_bom_quality_xlsx,
    build_internal_pricing_comparison_xlsx,
    build_internal_pricing_snapshot_xlsx,
    build_internal_pricing_workbench_xlsx,
    build_supplier_pricing_workbench_xlsx,
    build_supplier_purchase_report_xlsx,
)
from app.services.file_storage import get_file_storage

router = APIRouter(prefix="/exports", tags=["exports"])


class CustomerBomExportRequest(BaseModel):
    project_id: int
    bom_version_id: int


class SupplierWorkbenchExportRequest(BaseModel):
    project_id: int
    bom_version_id: int


class InternalBomQualityExportRequest(BaseModel):
    project_id: int
    bom_version_id: int


class InternalPricingExportRequest(BaseModel):
    project_id: int
    pricing_snapshot_id: int


class InternalWorkbenchExportRequest(BaseModel):
    project_id: int
    bom_version_id: int
    include_east: bool | None = None


class SupplierPurchaseExportRequest(BaseModel):
    project_id: int
    bom_version_id: int
    supplier: str = "all"
    include_east: bool = False


def _load_project(db: Session, project_id: int) -> Project:
    project = db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _load_bom_version(
    db: Session, project_id: int, bom_version_id: int
) -> tuple[Project, BomVersion, list[BomLine]]:
    project = _load_project(db, project_id)
    version = db.get(BomVersion, bom_version_id)
    if version is None or version.project_id != project.id:
        raise HTTPException(status_code=404, detail="BOM version not found")
    lines = list(
        db.scalars(
            select(BomLine)
            .where(BomLine.bom_version_id == version.id)
            .order_by(BomLine.line_no, BomLine.id)
        )
    )
    return project, version, lines


def _xlsx_response(content: bytes, file_name: str) -> Response:
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
    )


def _persist_export(
    db: Session,
    *,
    project_id: int,
    report_type: str,
    file_name: str,
    content: bytes,
    user_id: int | None,
    is_customer_safe: bool,
    bom_version_id: int | None = None,
    pricing_snapshot_id: int | None = None,
    action_type: str,
    change_summary: str,
) -> None:
    storage = get_file_storage()
    stored = storage.save(content, file_name, subdir="exports")
    report = ExportReport(
        project_id=project_id,
        bom_version_id=bom_version_id,
        pricing_snapshot_id=pricing_snapshot_id,
        report_type=report_type,
        file_name=file_name,
        file_path=stored.path,
        status="Generated",
        is_customer_safe=is_customer_safe,
        created_by_id=user_id,
    )
    db.add(report)
    log_activity(
        db,
        user_id=user_id,
        action_type=action_type,
        project_id=project_id,
        entity_type="export_report",
        entity_name=file_name,
        change_summary=change_summary,
        commit=False,
    )
    db.commit()


@router.post("/customer-bom-review")
def export_customer_bom_review(
    payload: CustomerBomExportRequest,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> Response:
    project, version, lines = _load_bom_version(
        db, payload.project_id, payload.bom_version_id
    )
    content, file_name = build_customer_bom_review_xlsx(
        db, project=project, version=version, lines=lines
    )
    _persist_export(
        db,
        project_id=project.id,
        report_type="customer_bom_review",
        file_name=file_name,
        content=content,
        user_id=user_id,
        is_customer_safe=True,
        bom_version_id=version.id,
        action_type="customer_export_created",
        change_summary=f"Customer BOM Review export '{file_name}'",
    )
    return _xlsx_response(content, file_name)


@router.post("/supplier-pricing-workbench")
def export_supplier_pricing_workbench(
    payload: SupplierWorkbenchExportRequest,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> Response:
    project, version, _lines = _load_bom_version(
        db, payload.project_id, payload.bom_version_id
    )
    content, file_name = build_supplier_pricing_workbench_xlsx(
        db, project=project, version=version
    )
    _persist_export(
        db,
        project_id=project.id,
        report_type="supplier_pricing_workbench",
        file_name=file_name,
        content=content,
        user_id=user_id,
        is_customer_safe=True,
        bom_version_id=version.id,
        action_type="supplier_workbench_export_created",
        change_summary=f"Supplier pricing workbench export '{file_name}'",
    )
    return _xlsx_response(content, file_name)


@router.post("/internal-bom-quality")
def export_internal_bom_quality(
    payload: InternalBomQualityExportRequest,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> Response:
    project, version, lines = _load_bom_version(
        db, payload.project_id, payload.bom_version_id
    )
    content, file_name = build_internal_bom_quality_xlsx(
        db, project=project, version=version, lines=lines
    )
    _persist_export(
        db,
        project_id=project.id,
        report_type="internal_bom_quality",
        file_name=file_name,
        content=content,
        user_id=user_id,
        is_customer_safe=False,
        bom_version_id=version.id,
        action_type="internal_export_created",
        change_summary=f"Internal BOM Quality export '{file_name}'",
    )
    return _xlsx_response(content, file_name)


@router.post("/internal-pricing-snapshot")
def export_internal_pricing_snapshot(
    payload: InternalPricingExportRequest,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> Response:
    project = _load_project(db, payload.project_id)
    snapshot = db.get(PricingSnapshot, payload.pricing_snapshot_id)
    if snapshot is None or snapshot.project_id != project.id:
        raise HTTPException(status_code=404, detail="Pricing snapshot not found")
    content, file_name = build_internal_pricing_snapshot_xlsx(
        db, project=project, snapshot=snapshot
    )
    _persist_export(
        db,
        project_id=project.id,
        report_type="internal_pricing_snapshot",
        file_name=file_name,
        content=content,
        user_id=user_id,
        is_customer_safe=False,
        pricing_snapshot_id=snapshot.id,
        bom_version_id=snapshot.bom_version_id,
        action_type="internal_export_created",
        change_summary=f"Internal Pricing Snapshot export '{file_name}'",
    )
    return _xlsx_response(content, file_name)


@router.post("/internal-pricing-workbench")
def export_internal_pricing_workbench(
    payload: InternalWorkbenchExportRequest,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> Response:
    project, version, _lines = _load_bom_version(
        db, payload.project_id, payload.bom_version_id
    )
    content, file_name = build_internal_pricing_workbench_xlsx(
        db,
        project=project,
        version=version,
        include_east=payload.include_east,
    )
    _persist_export(
        db,
        project_id=project.id,
        report_type="internal_pricing_workbench",
        file_name=file_name,
        content=content,
        user_id=user_id,
        is_customer_safe=False,
        bom_version_id=version.id,
        action_type="internal_export_created",
        change_summary=f"Internal Pricing Workbench export '{file_name}'",
    )
    return _xlsx_response(content, file_name)


@router.post("/internal-pricing-comparison")
def export_internal_pricing_comparison(
    payload: InternalWorkbenchExportRequest,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> Response:
    project, version, _lines = _load_bom_version(
        db, payload.project_id, payload.bom_version_id
    )
    content, file_name = build_internal_pricing_comparison_xlsx(
        db,
        project=project,
        version=version,
        include_east=payload.include_east,
    )
    _persist_export(
        db,
        project_id=project.id,
        report_type="internal_pricing_comparison",
        file_name=file_name,
        content=content,
        user_id=user_id,
        is_customer_safe=False,
        bom_version_id=version.id,
        action_type="internal_export_created",
        change_summary=f"Internal Pricing Comparison export '{file_name}'",
    )
    return _xlsx_response(content, file_name)


@router.post("/supplier-purchase-report")
def export_supplier_purchase_report(
    payload: SupplierPurchaseExportRequest,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> Response:
    project, version, _lines = _load_bom_version(
        db, payload.project_id, payload.bom_version_id
    )
    content, file_name = build_supplier_purchase_report_xlsx(
        db,
        project=project,
        version=version,
        supplier_filter=payload.supplier,
        include_east=payload.include_east,
    )
    _persist_export(
        db,
        project_id=project.id,
        report_type="supplier_purchase_report",
        file_name=file_name,
        content=content,
        user_id=user_id,
        is_customer_safe=False,
        bom_version_id=version.id,
        action_type="internal_export_created",
        change_summary=f"Supplier Purchase Report export '{file_name}'",
    )
    return _xlsx_response(content, file_name)


@router.get("/supplier-purchase-report")
def export_supplier_purchase_report_get(
    project_id: int,
    bom_version_id: int,
    supplier: str = "all",
    include_east: bool = False,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> Response:
    project, version, _lines = _load_bom_version(db, project_id, bom_version_id)
    content, file_name = build_supplier_purchase_report_xlsx(
        db,
        project=project,
        version=version,
        supplier_filter=supplier,
        include_east=include_east,
    )
    _persist_export(
        db,
        project_id=project.id,
        report_type="supplier_purchase_report",
        file_name=file_name,
        content=content,
        user_id=user_id,
        is_customer_safe=False,
        bom_version_id=version.id,
        action_type="internal_export_created",
        change_summary=f"Supplier Purchase Report export '{file_name}'",
    )
    return _xlsx_response(content, file_name)
