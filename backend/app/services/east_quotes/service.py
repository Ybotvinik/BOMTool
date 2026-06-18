"""East supplier quote upload, history, and activation."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import BomVersion, Project, SupplierQuote, SupplierQuoteLine
from app.services.activity import log_activity
from app.services.east_quotes.link_parser import parse_link_xlsx
from app.services.east_quotes.matching import match_east_quote_lines
from app.services.file_storage import get_file_storage

SOURCE_TYPE_EAST = "east"

# Digi-Key / Mouser stock-number patterns — must not appear as Link supplier PN in UI.
_DISTRIBUTOR_PN_SUFFIXES = ("-ND", "-DKR", "-TR-ND")


def _looks_like_distributor_pn(value: str | None) -> bool:
    if not value or not str(value).strip():
        return False
    v = str(value).strip().upper()
    if any(v.endswith(suffix) for suffix in _DISTRIBUTOR_PN_SUFFIXES):
        return True
    # Digi-Key numeric-dash pattern e.g. 490-9665-1-ND (already caught) or 490-9665-1
    parts = v.split("-")
    if len(parts) >= 3 and parts[0].isdigit() and parts[-1] in ("ND", "DKR", "1"):
        return True
    return False


def _east_supplier_pn_for_display(ql: SupplierQuoteLine) -> str | None:
    """Supplier PN for Link/East offers — use Link file fields, never distributor stock numbers."""
    for raw in (ql.supplier_part_number, ql.supplier_code):
        candidate = (raw or "").strip()
        if candidate and not _looks_like_distributor_pn(candidate):
            return candidate
    return None


def _east_mpn_for_display(ql: SupplierQuoteLine) -> str | None:
    return (ql.quoted_mpn or ql.mpn or "").strip() or None


def _normalize_supplier_key(name: str) -> str:
    return (name or "link").strip().lower().replace(" ", "_")


def list_east_quotes(
    db: Session, *, project_id: int, bom_version_id: int, supplier_name: str | None = None
) -> list[dict]:
    q = (
        select(SupplierQuote)
        .where(
            SupplierQuote.project_id == project_id,
            SupplierQuote.bom_version_id == bom_version_id,
            SupplierQuote.source_type == SOURCE_TYPE_EAST,
            SupplierQuote.status != "deleted",
        )
        .order_by(SupplierQuote.created_at.desc())
    )
    if supplier_name:
        q = q.where(SupplierQuote.supplier_name == supplier_name)
    quotes = list(db.scalars(q))
    out = []
    for quote in quotes:
        lines = list(
            db.scalars(
                select(SupplierQuoteLine).where(
                    SupplierQuoteLine.supplier_quote_id == quote.id
                )
            )
        )
        matched = sum(
            1
            for ln in lines
            if ln.match_status in ("exact_mpn", "designator_match", "matched")
        )
        out.append(
            {
                "id": quote.id,
                "supplier_name": quote.supplier_name,
                "source_filename": quote.source_file_name,
                "sheet_name": quote.sheet_name,
                "board_name": quote.board_name,
                "doc_number": quote.doc_number,
                "revised_date": quote.revised_date,
                "currency": quote.currency,
                "total_price_summary": float(quote.total_price_summary)
                if quote.total_price_summary is not None
                else None,
                "is_active": quote.is_active,
                "status": quote.status,
                "lines_count": len(lines),
                "matched_count": matched,
                "created_at": quote.created_at,
                "uploaded_at": quote.uploaded_at,
            }
        )
    return out


def get_active_east_quotes(
    db: Session, *, project_id: int, bom_version_id: int
) -> list[SupplierQuote]:
    return list(
        db.scalars(
            select(SupplierQuote).where(
                SupplierQuote.project_id == project_id,
                SupplierQuote.bom_version_id == bom_version_id,
                SupplierQuote.source_type == SOURCE_TYPE_EAST,
                SupplierQuote.is_active.is_(True),
                SupplierQuote.status == "active",
            )
        )
    )


def upload_east_quote(
    db: Session,
    *,
    content: bytes,
    filename: str,
    project_id: int,
    bom_version_id: int,
    supplier_name: str = "Link",
    replace_existing: bool = False,
    quote_id_to_replace: int | None = None,
    user_id: int | None,
) -> dict:
    project = db.get(Project, project_id)
    if project is None:
        raise ValueError("Project not found")
    version = db.get(BomVersion, bom_version_id)
    if version is None or version.project_id != project_id:
        raise ValueError("BOM version not found")

    parsed = parse_link_xlsx(content, filename)
    now = datetime.now(timezone.utc)
    supplier_key = _normalize_supplier_key(supplier_name)

    if replace_existing and quote_id_to_replace:
        old = db.get(SupplierQuote, quote_id_to_replace)
        if old is None:
            raise ValueError("Quote to replace not found")
        old.status = "archived"
        old.is_active = False
        old.updated_at = now

    # Deactivate other active quotes for same supplier unless we're only adding history
    if not replace_existing:
        db.execute(
            update(SupplierQuote)
            .where(
                SupplierQuote.project_id == project_id,
                SupplierQuote.bom_version_id == bom_version_id,
                SupplierQuote.source_type == SOURCE_TYPE_EAST,
                SupplierQuote.supplier_name == supplier_name,
                SupplierQuote.is_active.is_(True),
            )
            .values(is_active=False, status="archived", updated_at=now)
        )
    else:
        db.execute(
            update(SupplierQuote)
            .where(
                SupplierQuote.project_id == project_id,
                SupplierQuote.bom_version_id == bom_version_id,
                SupplierQuote.source_type == SOURCE_TYPE_EAST,
                SupplierQuote.supplier_name == supplier_name,
                SupplierQuote.is_active.is_(True),
            )
            .values(is_active=False, updated_at=now)
        )

    storage = get_file_storage()
    stored = storage.save(content, filename or "east-quote.xlsx", subdir="east-quotes")

    quote = SupplierQuote(
        project_id=project_id,
        bom_version_id=bom_version_id,
        quote_name=filename,
        supplier_name=supplier_name,
        source_type=SOURCE_TYPE_EAST,
        currency="USD",
        source_file_name=filename,
        sheet_name=parsed.sheet_name,
        board_name=parsed.board_name,
        doc_number=parsed.doc_number,
        revised_date=parsed.revised_date,
        total_price_summary=parsed.total_price_summary,
        unit_price_summary=parsed.unit_price_summary,
        status="active",
        is_active=True,
        replaced_quote_id=quote_id_to_replace if replace_existing else None,
        uploaded_by_user_id=user_id,
        uploaded_at=now,
        created_by_id=user_id,
        updated_at=now,
    )
    db.add(quote)
    db.flush()

    for ln in parsed.lines:
        db.add(
            SupplierQuoteLine(
                supplier_quote_id=quote.id,
                line_number=ln.row_number,
                quantity=ln.quantity,
                designator=ln.designator,
                mpn=ln.mpn,
                quoted_mpn=ln.mpn,
                cleaned_quoted_mpn=None,
                manufacturer=ln.manufacturer or ln.brand,
                description=ln.description,
                footprint=ln.footprint,
                value=ln.value,
                supplier_part_number=ln.supplier_part_number,
                assembly=ln.assembly,
                vendor=ln.vendor or supplier_name,
                quoted_qty=ln.quoted_qty,
                unit_price=ln.unit_price,
                total_price=ln.total_price,
                currency=ln.currency,
                lead_time=ln.lead_time,
                brand=ln.brand,
                supplier_code=ln.supplier_code,
                notes=ln.comments,
                is_dnp=ln.is_dnp,
                available_qty=int(ln.quoted_qty) if ln.quoted_qty else None,
                stock=int(ln.quoted_qty) if ln.quoted_qty else None,
            )
        )

    db.flush()
    match_summary = match_east_quote_lines(db, quote.id, bom_version_id)

    log_activity(
        db,
        user_id=user_id,
        action_type="east_quote_uploaded",
        project_id=project_id,
        entity_type="east_supplier_quote",
        entity_name=f"{supplier_name}: {filename}",
        change_summary=(
            f"East quote uploaded ({supplier_name}): {len(parsed.lines)} lines, "
            f"matched={match_summary.get('matched_count', 0)}"
        ),
        commit=False,
    )
    db.commit()

    return {
        "quote_id": quote.id,
        "supplier_name": supplier_name,
        "source_filename": filename,
        "board_name": parsed.board_name,
        "doc_number": parsed.doc_number,
        "revised_date": parsed.revised_date,
        "lines_imported": len(parsed.lines),
        "dnp_count": match_summary.get("dnp", 0),
        "match_summary": match_summary,
        "is_active": True,
    }


def set_active_quote(db: Session, quote_id: int, user_id: int | None) -> dict:
    quote = db.get(SupplierQuote, quote_id)
    if quote is None or quote.source_type != SOURCE_TYPE_EAST:
        raise ValueError("Quote not found")
    now = datetime.now(timezone.utc)
    db.execute(
        update(SupplierQuote)
        .where(
            SupplierQuote.project_id == quote.project_id,
            SupplierQuote.bom_version_id == quote.bom_version_id,
            SupplierQuote.supplier_name == quote.supplier_name,
            SupplierQuote.source_type == SOURCE_TYPE_EAST,
            SupplierQuote.id != quote_id,
        )
        .values(is_active=False, status="archived", updated_at=now)
    )
    quote.is_active = True
    quote.status = "active"
    quote.updated_at = now
    db.commit()
    return {"quote_id": quote_id, "is_active": True}


def archive_east_quote(db: Session, quote_id: int, user_id: int | None) -> dict:
    quote = db.get(SupplierQuote, quote_id)
    if quote is None or quote.source_type != SOURCE_TYPE_EAST:
        raise ValueError("Quote not found")
    now = datetime.now(timezone.utc)
    quote.status = "archived"
    quote.is_active = False
    quote.updated_at = now
    log_activity(
        db,
        user_id=user_id,
        action_type="east_quote_archived",
        project_id=quote.project_id,
        entity_type="east_supplier_quote",
        entity_name=quote.source_file_name,
        change_summary=f"Archived east quote {quote_id}",
        commit=True,
    )
    return {"quote_id": quote_id, "status": "archived"}


def set_include_east_pricing(
    db: Session, *, bom_version_id: int, include: bool, user_id: int | None
) -> dict:
    version = db.get(BomVersion, bom_version_id)
    if version is None:
        raise ValueError("BOM version not found")
    version.include_east_pricing = include
    db.commit()
    return {"bom_version_id": bom_version_id, "include_east_pricing": include}


def east_offers_by_bom_line(
    db: Session, *, project_id: int, bom_version_id: int
) -> dict[int, list[dict]]:
    """Active east quote lines grouped by matched BOM line id."""
    active_quotes = get_active_east_quotes(db, project_id=project_id, bom_version_id=bom_version_id)
    if not active_quotes:
        return {}

    quote_ids = [q.id for q in active_quotes]
    quote_by_id = {q.id: q for q in active_quotes}
    lines = list(
        db.scalars(
            select(SupplierQuoteLine).where(
                SupplierQuoteLine.supplier_quote_id.in_(quote_ids),
                SupplierQuoteLine.is_dnp.is_(False),
                SupplierQuoteLine.matched_bom_line_id.isnot(None),
            )
        )
    )
    out: dict[int, list[dict]] = {}
    for ql in lines:
        quote = quote_by_id.get(ql.supplier_quote_id)
        if quote is None:
            continue
        supplier_key = _normalize_supplier_key(quote.supplier_name)
        is_exact = ql.match_status in ("exact_mpn", "matched", "designator_match")
        offer = {
            "supplier": supplier_key,
            "supplier_display": quote.supplier_name,
            "mpn": _east_mpn_for_display(ql),
            "matched_mpn": _east_mpn_for_display(ql),
            "supplier_part_number": _east_supplier_pn_for_display(ql),
            "manufacturer": ql.manufacturer or ql.brand,
            "unit_price": float(ql.unit_price) if ql.unit_price is not None else None,
            "extended_price": float(ql.total_price) if ql.total_price is not None else None,
            "stock": float(ql.quoted_qty or ql.available_qty or 0) or None,
            "price_break_qty": float(ql.quoted_qty) if ql.quoted_qty else None,
            "match_status": ql.match_status,
            "match_reason": ql.match_reason,
            "is_exact_match": is_exact and ql.match_status in ("exact_mpn", "matched"),
            "product_url": None,
            "lead_time": ql.lead_time,
            "currency": ql.currency or "USD",
            "needs_review": ql.match_status in ("possible_match", "designator_match"),
            "internal_only": True,
            "source_type": "east_supplier_quote",
            "source_group": "East",
            "comments": ql.notes,
            "total_price": float(ql.total_price) if ql.total_price is not None else None,
            "quote_id": quote.id,
            "quote_line_id": ql.id,
        }
        bid = ql.matched_bom_line_id
        assert bid is not None
        out.setdefault(bid, []).append(offer)
    return out
