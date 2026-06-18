"""Match East supplier quote lines to BOM lines using effective values."""

from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import BomLine, BomLineOverride, SupplierQuoteLine
from app.services.bom_line_override import effective_values, overrides_for_version
from app.services.bom_quality import clean_mpn
from app.services.suppliers.base import normalize_mpn

MATCH_EXACT = "exact_mpn"
MATCH_DESIGNATOR = "designator_match"
MATCH_POSSIBLE = "possible_match"
MATCH_NOT_FOUND = "not_found"
MATCH_DNP = "dnp"


def _parse_designators(text: str | None) -> set[str]:
    if not text:
        return set()
    parts = re.split(r"[,;\s]+", text.strip())
    return {p.upper() for p in parts if p}


def match_east_quote_lines(db: Session, quote_id: int, bom_version_id: int | None) -> dict:
    q_lines = list(
        db.scalars(
            select(SupplierQuoteLine).where(SupplierQuoteLine.supplier_quote_id == quote_id)
        )
    )
    bom_lines: list[BomLine] = []
    override_map: dict[int, BomLineOverride] = {}
    if bom_version_id is not None:
        bom_lines = list(
            db.scalars(
                select(BomLine)
                .where(BomLine.bom_version_id == bom_version_id)
                .order_by(BomLine.line_no, BomLine.id)
            )
        )
        override_map = overrides_for_version(db, bom_version_id)

    by_mpn: dict[str, list[BomLine]] = {}
    by_designator: dict[str, list[BomLine]] = {}
    by_spn: dict[str, list[BomLine]] = {}

    for bl in bom_lines:
        ov = override_map.get(bl.id)
        eff = effective_values(bl, ov)
        cm = eff.get("cleaned_mpn") or clean_mpn(eff.get("mpn"))
        nm = normalize_mpn(eff.get("mpn"))
        if cm:
            by_mpn.setdefault(cm.upper(), []).append(bl)
        if nm:
            by_mpn.setdefault(nm, []).append(bl)
        for d in _parse_designators(bl.reference_designators):
            by_designator.setdefault(d, []).append(bl)
        spn = (bl.supplier_part_number or "").strip().upper()
        if spn:
            by_spn.setdefault(spn, []).append(bl)

    counts = {
        "exact_mpn": 0,
        "designator_match": 0,
        "possible_match": 0,
        "not_found": 0,
        "dnp": 0,
        "lines_total": len(q_lines),
    }

    for ql in q_lines:
        if ql.is_dnp:
            ql.matched_bom_line_id = None
            ql.match_status = MATCH_DNP
            ql.match_confidence = 0
            ql.match_reason = "DNP row in quote"
            counts["dnp"] += 1
            continue

        q_mpn = ql.quoted_mpn or ql.mpn
        ql.cleaned_quoted_mpn = clean_mpn(q_mpn)
        norm_q = normalize_mpn(q_mpn)
        q_spn = (ql.supplier_part_number or "").strip().upper()
        q_des = _parse_designators(ql.designator)

        target: BomLine | None = None
        status = MATCH_NOT_FOUND
        reason = "No match"
        confidence = 0

        if norm_q:
            for key in (ql.cleaned_quoted_mpn.upper() if ql.cleaned_quoted_mpn else None, norm_q):
                if key and key in by_mpn:
                    target = by_mpn[key][0]
                    status = MATCH_EXACT
                    reason = "Exact MPN match"
                    confidence = 100
                    break

        if target is None and q_des:
            for d in q_des:
                if d in by_designator:
                    target = by_designator[d][0]
                    status = MATCH_DESIGNATOR
                    reason = f"Designator match ({d})"
                    confidence = 85
                    break

        if target is None and q_spn and q_spn in by_spn:
            target = by_spn[q_spn][0]
            status = MATCH_DESIGNATOR
            reason = "Supplier PN match"
            confidence = 75

        if target is None and q_mpn:
            # Loose manufacturer/description similarity
            q_mfr = (ql.manufacturer or ql.brand or "").strip().upper()
            q_desc = (ql.description or "").strip().lower()
            for bl in bom_lines:
                ov = override_map.get(bl.id)
                eff = effective_values(bl, ov)
                b_mfr = (eff.get("manufacturer") or "").strip().upper()
                b_desc = (eff.get("description") or "").strip().lower()
                if q_mfr and b_mfr and q_mfr == b_mfr and q_desc and b_desc and (
                    q_desc in b_desc or b_desc in q_desc
                ):
                    target = bl
                    status = MATCH_POSSIBLE
                    reason = "Possible match (manufacturer + description)"
                    confidence = 60
                    break

        if target is None:
            ql.matched_bom_line_id = None
            ql.match_status = MATCH_NOT_FOUND
            ql.match_confidence = 0
            ql.match_reason = reason
            counts["not_found"] += 1
            continue

        ql.matched_bom_line_id = target.id
        ql.match_status = status
        ql.match_confidence = confidence
        ql.match_reason = reason
        counts[status] = counts.get(status, 0) + 1

    db.flush()
    counts["matched_count"] = counts["exact_mpn"] + counts["designator_match"]
    return counts
