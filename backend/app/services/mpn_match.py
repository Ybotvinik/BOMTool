"""Match supplier-quote lines to BOM lines by MPN."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import BomLine, SupplierQuoteLine
from app.services.bom_quality import clean_mpn, normalize_mpn


def _mfr(value: str | None) -> str:
    return (value or "").strip().upper()


def match_quote_lines(
    db: Session, supplier_quote_id: int, bom_version_id: int | None
) -> dict:
    """(Re)match all lines of a supplier quote to BOM lines of a version.

    Returns a summary dict with matched/possible/not-matched counts.
    """
    q_lines = list(
        db.scalars(
            select(SupplierQuoteLine).where(
                SupplierQuoteLine.supplier_quote_id == supplier_quote_id
            )
        )
    )
    bom_lines: list[BomLine] = []
    if bom_version_id is not None:
        bom_lines = list(
            db.scalars(
                select(BomLine).where(BomLine.bom_version_id == bom_version_id)
            )
        )

    # Index BOM lines by cleaned + normalized MPN (keep order for "first match").
    by_clean: dict[str, list[BomLine]] = {}
    by_norm: dict[str, list[BomLine]] = {}
    for bl in bom_lines:
        cm = bl.cleaned_mpn or clean_mpn(bl.mpn)
        if cm:
            by_clean.setdefault(cm, []).append(bl)
        nm = normalize_mpn(bl.mpn)
        if nm:
            by_norm.setdefault(nm, []).append(bl)

    matched = possible = not_matched = 0
    for ql in q_lines:
        cleaned_q = ql.cleaned_quoted_mpn or clean_mpn(ql.quoted_mpn or ql.mpn)
        ql.cleaned_quoted_mpn = cleaned_q
        norm_q = normalize_mpn(ql.quoted_mpn or ql.mpn)

        candidates: list[BomLine] = []
        reason = ""
        confidence = 0
        if cleaned_q and cleaned_q in by_clean:
            candidates = by_clean[cleaned_q]
            confidence = 100
            reason = "Exact MPN match"
        elif norm_q and norm_q in by_norm:
            candidates = by_norm[norm_q]
            confidence = 90
            reason = "Normalized MPN match"

        if not candidates:
            ql.matched_bom_line_id = None
            ql.match_status = "not_matched"
            ql.match_confidence = 0
            ql.match_reason = "No MPN match"
            not_matched += 1
            continue

        target = candidates[0]
        status = "matched"

        # Manufacturer conflict downgrades to possible_match.
        q_mfr = _mfr(ql.manufacturer)
        b_mfr = _mfr(target.manufacturer)
        if q_mfr and b_mfr and q_mfr != b_mfr:
            status = "possible_match"
            confidence = 70
            reason = "MPN match with manufacturer conflict"
        elif len(candidates) > 1:
            # Same MPN appears multiple times in the BOM.
            confidence = min(confidence, 80)
            reason = "Matched MPN appears in multiple BOM lines"

        ql.matched_bom_line_id = target.id
        ql.match_status = status
        ql.match_confidence = confidence
        ql.match_reason = reason
        if status == "matched":
            matched += 1
        else:
            possible += 1

    db.flush()
    return {
        "lines_total": len(q_lines),
        "matched_count": matched,
        "possible_match_count": possible,
        "not_matched_count": not_matched,
    }
