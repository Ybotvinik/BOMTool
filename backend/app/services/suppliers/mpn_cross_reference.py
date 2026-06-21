"""Cross-project MPN context for single-component lookups."""

from __future__ import annotations

from sqlalchemy import desc, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    BomLine,
    BomVersion,
    ComponentPriceLookup,
    Project,
    SupplierQuote,
    SupplierQuoteLine,
)
from app.services.bom_quality import clean_mpn, normalize_mpn
from app.services.export_excel import _line_in_purchase_report
from app.services.suppliers.workbench import get_workbench_results

_workbench_cache: dict[int, dict] = {}

MIN_PARTIAL_SEARCH_LEN = 3
INTERNAL_QUOTE_SOURCE_TYPES = ("china", "east")


def _mpn_keys(search_mpn: str) -> tuple[str | None, str]:
    cleaned = clean_mpn(search_mpn)
    norm = normalize_mpn(search_mpn)
    return cleaned, norm


def _search_too_short(cleaned: str | None, norm: str) -> bool:
    return not norm or len(norm) < MIN_PARTIAL_SEARCH_LEN


def _norm_mpn_matches(candidate: str | None, norm: str) -> bool:
    """Prefix match on normalized MPN (supports incomplete typing)."""
    if not candidate or not norm:
        return False
    cn = normalize_mpn(candidate)
    if not cn:
        return False
    return cn == norm or cn.startswith(norm) or norm.startswith(cn)


def _line_mpn_matches(bl: BomLine, cleaned: str | None, norm: str) -> bool:
    if not cleaned and not norm:
        return False
    bl_clean = bl.cleaned_mpn or clean_mpn(bl.mpn)
    if cleaned and bl_clean and bl_clean == cleaned:
        return True
    if _norm_mpn_matches(bl.mpn, norm):
        return True
    if bl_clean and _norm_mpn_matches(bl_clean, norm):
        return True
    if cleaned and bl_clean and bl_clean.startswith(cleaned):
        return True
    return False


def _quote_line_mpn_matches(
    ql: SupplierQuoteLine, cleaned: str | None, norm: str
) -> bool:
    for candidate in (ql.cleaned_quoted_mpn, ql.quoted_mpn, ql.mpn):
        if not candidate:
            continue
        if cleaned and clean_mpn(candidate) == cleaned:
            return True
        if _norm_mpn_matches(candidate, norm):
            return True
        if cleaned and clean_mpn(candidate) and clean_mpn(candidate).startswith(cleaned):
            return True
    return False


def _bom_sql_filter(cleaned: str | None):
    if not cleaned:
        return None
    return or_(
        BomLine.cleaned_mpn == cleaned,
        BomLine.cleaned_mpn.like(f"{cleaned}%"),
        func.upper(BomLine.mpn) == cleaned,
        func.upper(BomLine.mpn).like(f"{cleaned}%"),
    )


def _lookup_sql_filter(cleaned: str | None):
    if not cleaned:
        return None
    return or_(
        ComponentPriceLookup.cleaned_mpn == cleaned,
        ComponentPriceLookup.cleaned_mpn.like(f"{cleaned}%"),
    )


def _quote_sql_filter(cleaned: str | None):
    if not cleaned:
        return None
    return or_(
        SupplierQuoteLine.cleaned_quoted_mpn == cleaned,
        SupplierQuoteLine.cleaned_quoted_mpn.like(f"{cleaned}%"),
        func.upper(SupplierQuoteLine.quoted_mpn) == cleaned,
        func.upper(SupplierQuoteLine.quoted_mpn).like(f"{cleaned}%"),
        func.upper(SupplierQuoteLine.mpn) == cleaned,
        func.upper(SupplierQuoteLine.mpn).like(f"{cleaned}%"),
    )


def _workbench_line_for(
    db: Session, *, project_id: int, bom_version_id: int, bom_line_id: int
) -> dict | None:
    if bom_version_id not in _workbench_cache:
        _workbench_cache[bom_version_id] = get_workbench_results(
            db, project_id=project_id, bom_version_id=bom_version_id
        )
    data = _workbench_cache[bom_version_id]
    for ln in data.get("lines") or []:
        if ln.get("bom_line_id") == bom_line_id:
            return ln
    return None


def build_mpn_cross_references(
    db: Session,
    *,
    search_mpn: str,
    exclude_lookup_id: int | None = None,
) -> dict:
    """Historical BOM / purchase / internal-quote context for an MPN."""
    _workbench_cache.clear()
    cleaned, norm = _mpn_keys(search_mpn)
    if _search_too_short(cleaned, norm):
        return _empty_cross_references()

    prev_stmt = (
        select(ComponentPriceLookup)
        .options(selectinload(ComponentPriceLookup.project_additions))
        .where(_lookup_sql_filter(cleaned))
        .order_by(desc(ComponentPriceLookup.last_checked_at), desc(ComponentPriceLookup.id))
    )
    if exclude_lookup_id is not None:
        prev_stmt = prev_stmt.where(ComponentPriceLookup.id != exclude_lookup_id)
    previous_rows = list(db.scalars(prev_stmt.limit(20)))

    project_ids_for_names: set[int] = set()
    previous_lookups: list[dict] = []
    for row in previous_rows:
        if not _norm_mpn_matches(row.search_mpn, norm) and not (
            cleaned and row.cleaned_mpn and row.cleaned_mpn.startswith(cleaned)
        ):
            continue
        addition_projects: list[dict] = []
        for add in row.project_additions:
            project_ids_for_names.add(add.project_id)
            addition_projects.append(
                {
                    "project_id": add.project_id,
                    "bom_version_id": add.bom_version_id,
                    "bom_line_id": add.bom_line_id,
                }
            )
        previous_lookups.append(
            {
                "id": row.id,
                "search_mpn": row.search_mpn,
                "required_qty": float(row.required_qty),
                "created_at": row.created_at,
                "last_checked_at": row.last_checked_at,
                "added_to_projects": addition_projects,
            }
        )

    bom_rows = list(
        db.execute(
            select(BomLine, BomVersion, Project)
            .join(BomVersion, BomVersion.id == BomLine.bom_version_id)
            .join(Project, Project.id == BomVersion.project_id)
            .where(_bom_sql_filter(cleaned))
            .order_by(Project.name, BomVersion.id, BomLine.line_no, BomLine.id)
        )
    )
    bom_presence: list[dict] = []
    seen_line_ids: set[int] = set()
    for bl, version, project in bom_rows:
        if bl.id in seen_line_ids:
            continue
        if not _line_mpn_matches(bl, cleaned, norm):
            continue
        seen_line_ids.add(bl.id)
        project_ids_for_names.add(project.id)

        wb_line = _workbench_line_for(
            db,
            project_id=project.id,
            bom_version_id=version.id,
            bom_line_id=bl.id,
        )
        in_purchase = False
        source = None
        unit_price = None
        status = None
        solution_status = None
        if wb_line:
            in_purchase = _line_in_purchase_report(
                wb_line, "all", bool(version.include_east_pricing)
            )
            source = wb_line.get("source")
            unit_price = wb_line.get("unit_price")
            status = wb_line.get("status")
            solution_status = wb_line.get("solution_status")

        bom_presence.append(
            {
                "project_id": project.id,
                "project_name": project.name,
                "project_code": project.code,
                "bom_version_id": version.id,
                "version_label": version.version_label,
                "version_name": version.version_name,
                "bom_line_id": bl.id,
                "line_no": bl.line_no,
                "mpn": bl.mpn,
                "in_purchase_report": in_purchase,
                "source": source,
                "unit_price": unit_price,
                "status": status,
                "solution_status": solution_status,
            }
        )

    quote_rows = list(
        db.execute(
            select(SupplierQuoteLine, SupplierQuote, Project)
            .select_from(SupplierQuoteLine)
            .join(SupplierQuote, SupplierQuote.id == SupplierQuoteLine.supplier_quote_id)
            .join(Project, Project.id == SupplierQuote.project_id)
            .where(
                SupplierQuote.source_type.in_(INTERNAL_QUOTE_SOURCE_TYPES),
                SupplierQuote.status != "deleted",
                _quote_sql_filter(cleaned),
            )
            .order_by(desc(SupplierQuote.created_at), SupplierQuoteLine.id)
        )
    )
    china_quotes: list[dict] = []
    seen_quote_lines: set[int] = set()
    for ql, quote, project in quote_rows:
        if ql.id in seen_quote_lines:
            continue
        if not _quote_line_mpn_matches(ql, cleaned, norm):
            continue
        seen_quote_lines.add(ql.id)
        project_ids_for_names.add(project.id)
        china_quotes.append(
            {
                "quote_id": quote.id,
                "quote_name": quote.quote_name,
                "supplier_name": quote.supplier_name,
                "quote_source_type": quote.source_type,
                "project_id": project.id,
                "project_name": project.name,
                "quoted_mpn": ql.quoted_mpn or ql.mpn,
                "unit_price": float(ql.unit_price) if ql.unit_price is not None else None,
                "currency": ql.currency or quote.currency,
                "is_active": bool(quote.is_active),
                "match_status": ql.match_status,
                "quote_date": quote.quote_date,
                "created_at": quote.created_at,
            }
        )

    project_names: dict[int, str] = {}
    if project_ids_for_names:
        for p in db.scalars(select(Project).where(Project.id.in_(project_ids_for_names))):
            project_names[p.id] = p.name

    for entry in previous_lookups:
        for add in entry["added_to_projects"]:
            add["project_name"] = project_names.get(add["project_id"])

    projects_with_bom = sorted({b["project_name"] for b in bom_presence})
    projects_in_purchase = sorted(
        {b["project_name"] for b in bom_presence if b["in_purchase_report"]}
    )
    projects_from_lookups = sorted(
        {
            add["project_name"]
            for entry in previous_lookups
            for add in entry["added_to_projects"]
            if add.get("project_name")
        }
    )
    projects_with_quotes = sorted({q["project_name"] for q in china_quotes})
    all_projects = sorted(
        set(projects_with_bom) | set(projects_from_lookups) | set(projects_with_quotes)
    )

    matched_mpns = [
        *(b["mpn"] for b in bom_presence if b.get("mpn")),
        *(q["quoted_mpn"] for q in china_quotes if q.get("quoted_mpn")),
    ]
    is_partial = any(
        len(normalize_mpn(mpn_val)) > len(norm)
        for mpn_val in matched_mpns
        if normalize_mpn(mpn_val).startswith(norm)
    )

    return {
        "cleaned_mpn": cleaned,
        "is_partial_match": is_partial,
        "previously_searched": len(previous_lookups) > 0,
        "previous_lookup_count": len(previous_lookups),
        "previous_lookups": previous_lookups,
        "bom_presence": bom_presence,
        "china_quotes": china_quotes,
        "summary": {
            "projects_seen": all_projects,
            "projects_with_bom_line": projects_with_bom,
            "projects_in_purchase_report": projects_in_purchase,
            "in_purchase_report_any": len(projects_in_purchase) > 0,
            "china_quote_hit": len(china_quotes) > 0,
            "china_quote_count": len(china_quotes),
        },
    }


def _empty_cross_references() -> dict:
    return {
        "cleaned_mpn": None,
        "is_partial_match": False,
        "previously_searched": False,
        "previous_lookup_count": 0,
        "previous_lookups": [],
        "bom_presence": [],
        "china_quotes": [],
        "summary": {
            "projects_seen": [],
            "projects_with_bom_line": [],
            "projects_in_purchase_report": [],
            "in_purchase_report_any": False,
            "china_quote_hit": False,
            "china_quote_count": 0,
        },
    }
