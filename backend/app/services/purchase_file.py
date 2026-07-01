"""Internal supplier purchase planning derived from pricing workbench selections."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models import BomVersion, Customer, OfficialPriceSnapshot, Project
from app.schemas.purchase_file import (
    PurchaseFileBomVersion,
    PurchaseFileLine,
    PurchaseFileProject,
    PurchaseFileResponse,
    PurchaseFileSnapshotOption,
    PurchaseFileSummary,
    PurchaseSupplierSummary,
)
from app.services.export_excel import (
    _line_in_purchase_report,
    _normalize_purchase_supplier_filter,
    _pricing_mode_label,
    _purchase_line_supplier_key,
    _workbench_data,
)

_SUPPLIER_LABELS: dict[str, str] = {
    "digikey": "Digi-Key",
    "mouser": "Mouser",
    "ti": "TI",
    "china": "סין / מזרח",
    "manual": "Manual",
    "tbd": "TBD / No Solution",
}


def _match_reason(line: dict) -> str | None:
    for offer in line.get("offers") or []:
        if offer.get("is_currently_selected"):
            return offer.get("match_reason")
    return None


def _to_purchase_line(line: dict, *, needs_handling: bool = False) -> PurchaseFileLine:
    key = _purchase_line_supplier_key(line)
    return PurchaseFileLine(
        bom_line_id=line["bom_line_id"],
        line_number=line.get("line_no"),
        supplier=line.get("selected_supplier") or line.get("source"),
        source=line.get("source"),
        source_type=line.get("selected_source_type"),
        internal_only=bool(line.get("source_is_internal")),
        mpn=line.get("mpn"),
        manufacturer=line.get("manufacturer"),
        description=line.get("description"),
        designators=line.get("reference_designators"),
        required_qty=line.get("required_qty"),
        supplier_part_number=line.get("supplier_part_number"),
        unit_price=line.get("unit_price"),
        extended_price=line.get("extended_price"),
        currency=line.get("currency") or "USD",
        stock=line.get("stock"),
        lead_time=line.get("lead_time"),
        status=line.get("status"),
        solution_status=line.get("solution_status"),
        notes=line.get("notes") or line.get("east_pricing_disabled_note"),
        match_reason=_match_reason(line),
        needs_handling=needs_handling,
        offers=line.get("offers") or [],
    )


def _lead_time_summary(lines: list[PurchaseFileLine]) -> str | None:
    values = sorted({ln.lead_time for ln in lines if ln.lead_time})
    if not values:
        return None
    if len(values) == 1:
        return values[0]
    return f"{values[0]} … {values[-1]}"


def build_purchase_file(
    db: Session,
    *,
    project_id: int,
    bom_version_id: int,
    supplier_filter: str = "all",
    include_east: bool | None = None,
    snapshot_id: int | None = None,
) -> PurchaseFileResponse:
    project = db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise ValueError("Project not found")

    version = db.get(BomVersion, bom_version_id)
    if version is None or version.project_id != project_id:
        raise ValueError("BOM version not found")

    customer_name: str | None = None
    if project.customer_id:
        customer = db.get(Customer, project.customer_id)
        customer_name = customer.name if customer else None

    east_on = (
        bool(include_east)
        if include_east is not None
        else bool(version.include_east_pricing)
    )
    filt = _normalize_purchase_supplier_filter(supplier_filter)
    data = _workbench_data(db, project=project, version=version, include_east=east_on)

    snapshots = list(
        db.scalars(
            select(OfficialPriceSnapshot)
            .where(OfficialPriceSnapshot.bom_version_id == bom_version_id)
            .order_by(desc(OfficialPriceSnapshot.created_at))
        )
    )
    snapshot_name: str | None = None
    if snapshot_id is not None:
        snap = db.get(OfficialPriceSnapshot, snapshot_id)
        if snap and snap.bom_version_id == bom_version_id:
            snapshot_name = snap.snapshot_name

    purchase_lines: list[PurchaseFileLine] = []
    needs_handling_lines: list[PurchaseFileLine] = []
    summary = PurchaseFileSummary()
    supplier_buckets: dict[str, list[PurchaseFileLine]] = defaultdict(list)

    for raw in data.get("lines") or []:
        key = _purchase_line_supplier_key(raw)
        if key == "dnp":
            summary.dnp_excluded += 1
            continue

        if not east_on and key == "china":
            pl = _to_purchase_line(raw, needs_handling=True)
            needs_handling_lines.append(pl)
            summary.needs_handling += 1
            continue

        if raw.get("solution_status") == "No Solution" or key == "tbd":
            summary.no_solution += 1
        if raw.get("solution_status") == "Needs Approval":
            summary.needs_approval += 1
        if raw.get("status") == "No Stock":
            summary.no_stock += 1
        if (
            raw.get("solution_status") == "Has Solution"
            and raw.get("status") != "No Stock"
            and key not in ("tbd", "dnp")
        ):
            summary.ready_lines += 1

        if not _line_in_purchase_report(raw, filt, east_on):
            continue

        pl = _to_purchase_line(raw)
        purchase_lines.append(pl)
        supplier_buckets[key].append(pl)

        ext = pl.extended_price
        if ext is not None:
            summary.grand_total += float(ext)

    summary.purchase_lines = len(purchase_lines)

    supplier_summaries: list[PurchaseSupplierSummary] = []
    for key, rows in sorted(supplier_buckets.items(), key=lambda kv: kv[0]):
        label = _SUPPLIER_LABELS.get(key, key.title())
        total = sum(float(r.extended_price or 0) for r in rows)
        supplier_summaries.append(
            PurchaseSupplierSummary(
                supplier=label,
                supplier_key=key,
                source_type=rows[0].source_type,
                internal_only=any(r.internal_only for r in rows),
                lines_count=len(rows),
                total=total,
                needs_approval=sum(1 for r in rows if r.solution_status == "Needs Approval"),
                no_stock=sum(1 for r in rows if r.status == "No Stock"),
                no_solution=sum(1 for r in rows if r.solution_status == "No Solution"),
                lead_time_summary=_lead_time_summary(rows),
            )
        )

    return PurchaseFileResponse(
        project=PurchaseFileProject(
            id=project.id,
            name=project.name,
            code=project.code,
            customer_name=customer_name,
        ),
        bom_version=PurchaseFileBomVersion(
            id=version.id,
            version_label=version.version_label,
            version_name=version.version_name,
            build_quantity=version.build_quantity,
            is_active=version.is_active,
            is_project_active=project.active_version_id == version.id,
        ),
        pricing_mode=_pricing_mode_label(east_on),
        include_east=east_on,
        supplier_filter=filt,
        snapshot_id=snapshot_id,
        snapshot_name=snapshot_name,
        generated_at=datetime.now(timezone.utc),
        summary=summary,
        supplier_summaries=supplier_summaries,
        lines=purchase_lines,
        needs_handling_lines=needs_handling_lines,
        available_snapshots=[
            PurchaseFileSnapshotOption(
                id=s.id,
                snapshot_name=s.snapshot_name,
                created_at=s.created_at,
            )
            for s in snapshots
        ],
    )
