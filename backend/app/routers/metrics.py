from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    BomLine,
    BomVersion,
    Customer,
    ExportReport,
    OfficialPriceLine,
    OfficialPriceSnapshot,
    PricingLine,
    PricingSnapshot,
    Project,
    ProjectCard,
    ProjectFile,
    SupplierQuote,
    SupplierQuoteLine,
)
from app.services.bom_quality import compute_quality_summary
from app.services.project_build import effective_build_quantity
from app.services.suppliers.workbench import get_workbench_results

router = APIRouter(prefix="/projects", tags=["metrics"])


def _compute_metrics(
    db: Session,
    project: Project,
    *,
    version_id: int | None = None,
) -> dict:
    customer = db.get(Customer, project.customer_id)
    out: dict = {
        "project_id": project.id,
        "project_name": project.name,
        "project_code": project.code,
        "customer_id": project.customer_id,
        "customer_name": customer.name if customer else None,
        "status": project.status,
        "description": project.description,
        "active_bom_version_id": project.active_version_id,
        "active_bom_version_name": None,
        "active_bom_version_label": None,
        "active_bom_is_active": None,
        "bom_total_lines": 0,
        "bom_non_dnp_lines": 0,
        "bom_dnp_count": 0,
        "bom_ok_count": 0,
        "bom_quality_score": None,
        "bom_needs_review_count": 0,
        "bom_error_count": 0,
        "bom_warning_count": 0,
        "official_selected_total": None,
        "official_has_solution": 0,
        "official_needs_approval": 0,
        "official_no_solution": 0,
        "official_dnp": 0,
        "official_snapshot_id": None,
        "official_snapshot_name": None,
        "official_snapshot_total": None,
        "official_snapshot_created_at": None,
        "latest_customer_export_at": None,
        "latest_procurement_export_at": None,
        "project_files_count": 0,
        "latest_china_quote_id": None,
        "latest_china_quote_name": None,
        "latest_china_quote_matched_count": 0,
        "latest_china_quote_possible_count": 0,
        "latest_china_quote_not_matched_count": 0,
        "latest_pricing_snapshot_id": None,
        "latest_pricing_snapshot_name": None,
        "latest_internal_cost": None,
        "latest_internal_cost_currency": None,
        "missing_price_count": 0,
        "updated_at": project.updated_at.isoformat() if project.updated_at else None,
        "build_quantity": project.build_quantity,
        "effective_build_quantity": project.build_quantity,
        "bom_revision_code": None,
        "bom_doc_number": None,
        "bom_board_name": None,
        "bom_version_notes": None,
        "card_id": None,
        "card_name": None,
        "card_build_quantity": None,
        "batch_label": None,
        "selected_version_id": None,
        "batch_build_quantity": None,
    }

    version: BomVersion | None = None
    if version_id is not None:
        version = db.get(BomVersion, version_id)
        if version is None or version.project_id != project.id:
            raise HTTPException(status_code=400, detail="גרסת BOM לא תקינה לפרויקט")
    elif project.active_version_id is not None:
        version = db.get(BomVersion, project.active_version_id)
    if version is not None:
        out["selected_version_id"] = version.id
        out["active_bom_version_id"] = version.id
        out["active_bom_version_name"] = version.version_name or version.version_label
        out["active_bom_version_label"] = version.version_label
        out["active_bom_is_active"] = version.is_active
        out["bom_revision_code"] = version.revision_code
        out["bom_doc_number"] = version.source_doc_number
        out["bom_board_name"] = version.board_name
        out["bom_version_notes"] = version.notes
        out["batch_label"] = (
            version.batch_label or version.version_name or version.version_label
        )
        out["batch_build_quantity"] = version.build_quantity
        card = db.get(ProjectCard, version.card_id) if version.card_id else None
        if card is not None:
            out["card_id"] = card.id
            out["card_name"] = card.name
            out["card_build_quantity"] = card.build_quantity
            if not out["bom_board_name"]:
                out["bom_board_name"] = card.board_name
        out["effective_build_quantity"] = effective_build_quantity(
            version, card=card, project=project
        )
        out["build_quantity"] = (
            card.build_quantity if card is not None else project.build_quantity
        )
        lines = list(
            db.scalars(select(BomLine).where(BomLine.bom_version_id == version.id))
        )
        summary = compute_quality_summary(lines)
        out["bom_total_lines"] = summary["total_lines"]
        out["bom_dnp_count"] = summary["dnp_count"]
        out["bom_non_dnp_lines"] = max(0, summary["total_lines"] - summary["dnp_count"])
        out["bom_ok_count"] = summary["ok_count"]
        out["bom_quality_score"] = summary["quality_score"] if lines else None
        out["bom_needs_review_count"] = summary["needs_review_count"]
        out["bom_error_count"] = summary["error_count"]
        out["bom_warning_count"] = summary["warning_count"]

        try:
            wb = get_workbench_results(
                db, project_id=project.id, bom_version_id=version.id
            )
            ws = wb.get("summary") or {}
            out["official_selected_total"] = ws.get("selected_total_cost")
            out["official_has_solution"] = ws.get("has_solution", 0)
            out["official_needs_approval"] = ws.get("needs_approval", 0)
            out["official_no_solution"] = ws.get("no_solution", 0)
            out["official_dnp"] = ws.get("dnp", 0)
            wb_lines = wb.get("lines") or []
            out["official_priced_lines"] = sum(
                1 for ln in wb_lines if ln.get("unit_price") is not None
            )
            out["official_no_stock_count"] = sum(
                1 for ln in wb_lines if ln.get("status") == "No Stock"
            )
            out["official_missing_prices"] = ws.get("no_solution", 0)
        except Exception:  # noqa: BLE001
            pass

        official_snap = db.scalar(
            select(OfficialPriceSnapshot)
            .where(
                OfficialPriceSnapshot.project_id == project.id,
                OfficialPriceSnapshot.bom_version_id == version.id,
            )
            .order_by(desc(OfficialPriceSnapshot.created_at))
        )
        if official_snap is not None:
            out["official_snapshot_id"] = official_snap.id
            out["official_snapshot_name"] = official_snap.snapshot_name
            out["official_snapshot_created_at"] = (
                official_snap.created_at.isoformat() if official_snap.created_at else None
            )
            snap_lines = list(
                db.scalars(
                    select(OfficialPriceLine).where(
                        OfficialPriceLine.snapshot_id == official_snap.id
                    )
                )
            )
            out["official_snapshot_total"] = float(
                sum(float(l.official_extended_price or 0) for l in snap_lines)
            )

    quote = db.scalar(
        select(SupplierQuote)
        .where(
            SupplierQuote.project_id == project.id,
            SupplierQuote.source_type == "china",
        )
        .order_by(SupplierQuote.id.desc())
    )
    if quote is not None:
        out["latest_china_quote_id"] = quote.id
        out["latest_china_quote_name"] = quote.quote_name
        q_lines = list(
            db.scalars(
                select(SupplierQuoteLine).where(
                    SupplierQuoteLine.supplier_quote_id == quote.id
                )
            )
        )
        out["latest_china_quote_matched_count"] = sum(
            1 for l in q_lines if l.match_status == "matched"
        )
        out["latest_china_quote_possible_count"] = sum(
            1 for l in q_lines if l.match_status == "possible_match"
        )
        out["latest_china_quote_not_matched_count"] = sum(
            1 for l in q_lines if l.match_status == "not_matched"
        )

    snap = db.scalar(
        select(PricingSnapshot)
        .where(PricingSnapshot.project_id == project.id)
        .order_by(PricingSnapshot.id.desc())
    )
    if snap is not None:
        out["latest_pricing_snapshot_id"] = snap.id
        out["latest_pricing_snapshot_name"] = snap.snapshot_name or snap.name
        out["latest_internal_cost_currency"] = snap.currency
        p_lines = list(
            db.scalars(
                select(PricingLine).where(PricingLine.pricing_snapshot_id == snap.id)
            )
        )
        out["latest_internal_cost"] = float(
            sum(float(l.extended_cost or 0) for l in p_lines)
        )
        out["missing_price_count"] = sum(
            1 for l in p_lines if l.pricing_status == "missing_price"
        )

    customer_export = db.scalar(
        select(ExportReport)
        .where(
            ExportReport.project_id == project.id,
            ExportReport.is_customer_safe.is_(True),
        )
        .order_by(desc(ExportReport.created_at))
    )
    if customer_export and customer_export.created_at:
        out["latest_customer_export_at"] = customer_export.created_at.isoformat()

    proc_export = db.scalar(
        select(ExportReport)
        .where(
            ExportReport.project_id == project.id,
            ExportReport.report_type.ilike("%procurement%"),
        )
        .order_by(desc(ExportReport.created_at))
    )
    if proc_export and proc_export.created_at:
        out["latest_procurement_export_at"] = proc_export.created_at.isoformat()

    files_count = db.scalar(
        select(func.count())
        .select_from(ProjectFile)
        .where(ProjectFile.project_id == project.id)
    )
    out["project_files_count"] = int(files_count or 0)

    return out


@router.get("/metrics")
def all_project_metrics(db: Session = Depends(get_db)) -> list[dict]:
    projects = list(
        db.scalars(
            select(Project).where(Project.deleted_at.is_(None)).order_by(Project.id)
        )
    )
    return [_compute_metrics(db, p) for p in projects]


@router.get("/{project_id}/metrics")
def project_metrics(
    project_id: int,
    version_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    project = db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Project not found")
    return _compute_metrics(db, project, version_id=version_id)
