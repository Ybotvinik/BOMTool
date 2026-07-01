"""Aggregate supplier pricing across all project cards for production planning."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import BomVersion, Project, ProjectCard
from app.services.project_build import effective_build_quantity
from app.services.project_overview import build_project_overview
from app.services.suppliers.workbench import get_workbench_results


def _default_batch(card: dict, active_version_id: int | None) -> dict | None:
    batches = card.get("batches") or []
    if not batches:
        return None
    if active_version_id is not None:
        for batch in batches:
            if batch["id"] == active_version_id:
                return batch
    active = next((b for b in batches if b.get("is_project_active")), None)
    return active or batches[-1]


def _merge_scenario_stats(target: dict, source: dict) -> None:
    for key in ("total", "priced_lines", "needs_approval", "no_solution", "no_stock", "east_selected_lines"):
        target[key] += int(source.get(key) or 0) if key != "total" else float(source.get(key) or 0)


def get_project_production_summary(db: Session, *, project_id: int) -> dict:
    project = db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise ValueError("Project not found")

    overview = build_project_overview(db, project_id)
    active_version_id = overview.get("active_version_id")

    cards_out: list[dict] = []
    agg_official = {
        "total": 0.0,
        "priced_lines": 0,
        "needs_approval": 0,
        "no_solution": 0,
        "no_stock": 0,
        "east_selected_lines": 0,
    }
    agg_east = {
        "total": 0.0,
        "priced_lines": 0,
        "needs_approval": 0,
        "no_solution": 0,
        "no_stock": 0,
        "east_selected_lines": 0,
    }
    product_unit_official = 0.0
    product_unit_east = 0.0
    has_unit_official = False
    has_unit_east = False
    cards_with_bom = 0

    for card in overview.get("cards") or []:
        batch = _default_batch(card, active_version_id)
        batch_id = batch["id"] if batch else None
        batch_label = batch.get("batch_label") if batch else None
        bom_items = int(batch.get("bom_items_count") or 0) if batch else 0
        has_bom = batch_id is not None and bom_items > 0

        entry: dict = {
            "card_id": card["id"],
            "card_name": card["name"],
            "board_name": card.get("board_name"),
            "bom_version_id": batch_id,
            "batch_label": batch_label,
            "build_quantity": 0,
            "bom_items_count": bom_items,
            "include_east_pricing": False,
            "has_bom": has_bom,
            "pricing_comparison": None,
            "official_unit_cost": None,
            "east_unit_cost": None,
            "official_batch_total": 0.0,
            "east_batch_total": 0.0,
            "savings_amount": 0.0,
            "savings_percent": None,
        }

        if not has_bom:
            cards_out.append(entry)
            continue

        cards_with_bom += 1
        wb = get_workbench_results(db, project_id=project_id, bom_version_id=batch_id)
        version = db.get(BomVersion, batch_id)
        project_card = db.get(ProjectCard, card["id"])
        build_qty = effective_build_quantity(version, card=project_card, project=project)
        cmp = wb.get("pricing_comparison") or {}
        off = cmp.get("official_only") or {}
        east = cmp.get("with_east") or {}
        off_total = float(off.get("total") or 0)
        east_total = float(east.get("total") or 0)
        savings_amount = off_total - east_total
        savings_percent = (savings_amount / off_total * 100) if off_total > 0 else None

        entry["build_quantity"] = build_qty
        entry["include_east_pricing"] = bool(wb.get("include_east_pricing"))
        entry["pricing_comparison"] = cmp
        entry["official_batch_total"] = off_total
        entry["east_batch_total"] = east_total
        entry["savings_amount"] = savings_amount
        entry["savings_percent"] = savings_percent
        if build_qty > 0 and off_total > 0:
            entry["official_unit_cost"] = off_total / build_qty
            has_unit_official = True
            product_unit_official += off_total / build_qty
        if build_qty > 0 and east_total > 0:
            entry["east_unit_cost"] = east_total / build_qty
            has_unit_east = True
            product_unit_east += east_total / build_qty

        _merge_scenario_stats(agg_official, off)
        _merge_scenario_stats(agg_east, east)
        cards_out.append(entry)

    batch_savings = float(agg_official["total"]) - float(agg_east["total"])
    batch_savings_pct = (
        batch_savings / float(agg_official["total"]) * 100
        if agg_official["total"] > 0
        else None
    )
    product_savings = None
    product_savings_pct = None
    if has_unit_official and has_unit_east:
        product_savings = product_unit_official - product_unit_east
        if product_unit_official > 0:
            product_savings_pct = product_savings / product_unit_official * 100

    return {
        "project_id": project.id,
        "project_name": project.name,
        "project_code": project.code,
        "card_count": len(overview.get("cards") or []),
        "cards_with_bom": cards_with_bom,
        "product_unit_official": product_unit_official if has_unit_official else None,
        "product_unit_east": product_unit_east if has_unit_east else None,
        "product_unit_savings": product_savings,
        "product_unit_savings_percent": product_savings_pct,
        "batch_totals": {
            "official_only": agg_official,
            "with_east": agg_east,
            "savings": {
                "amount": batch_savings,
                "percent": batch_savings_pct,
                "is_saving": batch_savings > 0,
            },
        },
        "cards": cards_out,
    }
