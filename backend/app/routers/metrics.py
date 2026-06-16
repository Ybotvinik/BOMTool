from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    BomLine,
    BomVersion,
    Customer,
    PricingLine,
    PricingSnapshot,
    Project,
    SupplierQuote,
    SupplierQuoteLine,
)
from app.services.bom_quality import compute_quality_summary

router = APIRouter(prefix="/projects", tags=["metrics"])


def _compute_metrics(db: Session, project: Project) -> dict:
    customer = db.get(Customer, project.customer_id)
    out: dict = {
        "project_id": project.id,
        "project_name": project.name,
        "project_code": project.code,
        "customer_id": project.customer_id,
        "customer_name": customer.name if customer else None,
        "status": project.status,
        "active_bom_version_id": project.active_version_id,
        "active_bom_version_name": None,
        "bom_total_lines": 0,
        "bom_quality_score": None,
        "bom_needs_review_count": 0,
        "bom_error_count": 0,
        "bom_warning_count": 0,
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
        "bom_revision_code": None,
        "bom_doc_number": None,
        "bom_board_name": None,
    }

    # Active BOM version + quality.
    if project.active_version_id is not None:
        version = db.get(BomVersion, project.active_version_id)
        if version is not None:
            out["active_bom_version_name"] = version.version_name or version.version_label
            out["bom_revision_code"] = version.revision_code
            out["bom_doc_number"] = version.source_doc_number
            out["bom_board_name"] = version.board_name
            lines = list(
                db.scalars(
                    select(BomLine).where(BomLine.bom_version_id == version.id)
                )
            )
            summary = compute_quality_summary(lines)
            out["bom_total_lines"] = summary["total_lines"]
            out["bom_quality_score"] = summary["quality_score"] if lines else None
            out["bom_needs_review_count"] = summary["needs_review_count"]
            out["bom_error_count"] = summary["error_count"]
            out["bom_warning_count"] = summary["warning_count"]

    # Latest China quote + match counts.
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

    # Latest pricing snapshot + totals.
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
                select(PricingLine).where(
                    PricingLine.pricing_snapshot_id == snap.id
                )
            )
        )
        out["latest_internal_cost"] = float(
            sum(float(l.extended_cost or 0) for l in p_lines)
        )
        out["missing_price_count"] = sum(
            1 for l in p_lines if l.pricing_status == "missing_price"
        )
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
def project_metrics(project_id: int, db: Session = Depends(get_db)) -> dict:
    project = db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Project not found")
    return _compute_metrics(db, project)