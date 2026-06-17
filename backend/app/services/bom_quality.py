"""BOM line quality analysis + MPN cleaning helpers."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import BomLine, BomLineOverride, BomVersion

STATUS_OK = "ok"
STATUS_WARNING = "warning"
STATUS_ERROR = "error"


def clean_mpn(value: str | None) -> str | None:
    """Light normalization for display/equality: trim, collapse spaces, upper."""
    if not value:
        return None
    cleaned = re.sub(r"\s+", " ", str(value).strip()).upper()
    return cleaned or None


def normalize_mpn(value: str | None) -> str:
    """Aggressive normalization for matching: drop spaces/hyphens/underscores."""
    if not value:
        return ""
    return re.sub(r"[\s\-_]", "", str(value)).upper()


def parse_refdes(value: str | None) -> list[str]:
    """Split reference designators on comma/semicolon/whitespace."""
    if not value:
        return []
    parts = re.split(r"[,;\s]+", str(value).strip())
    return [p.strip().upper() for p in parts if p.strip()]


def compute_required_qty(qty: Decimal | float | None, build_quantity: int | None, dnp: bool) -> Decimal:
    if dnp:
        return Decimal(0)
    if qty is None:
        return Decimal(0)
    bq = build_quantity if build_quantity and build_quantity > 0 else 1
    return Decimal(str(qty)) * Decimal(bq)


@dataclass
class QualityContext:
    """Version-wide context for cross-line rules (duplicates)."""

    # cleaned_mpn -> set of (manufacturer, description) seen
    mpn_variants: dict[str, set[tuple[str, str]]] = field(default_factory=dict)
    mpn_counts: dict[str, int] = field(default_factory=dict)
    refdes_counts: dict[str, int] = field(default_factory=dict)


@dataclass
class LineQualityInput:
    mpn: str | None
    manufacturer: str | None
    description: str | None
    quantity: Decimal | None
    dnp: bool
    cleaned_mpn: str | None
    reference_designators: str | None


def build_context_from_inputs(lines: list[LineQualityInput]) -> QualityContext:
    ctx = QualityContext()
    for ln in lines:
        cm = ln.cleaned_mpn or clean_mpn(ln.mpn)
        if cm:
            ctx.mpn_counts[cm] = ctx.mpn_counts.get(cm, 0) + 1
            ctx.mpn_variants.setdefault(cm, set()).add(
                ((ln.manufacturer or "").strip().upper(), (ln.description or "").strip().upper())
            )
        for rd in parse_refdes(ln.reference_designators):
            ctx.refdes_counts[rd] = ctx.refdes_counts.get(rd, 0) + 1
    return ctx


def build_context(lines: list[BomLine]) -> QualityContext:
    ctx = QualityContext()
    for ln in lines:
        cm = ln.cleaned_mpn or clean_mpn(ln.mpn)
        if cm:
            ctx.mpn_counts[cm] = ctx.mpn_counts.get(cm, 0) + 1
            ctx.mpn_variants.setdefault(cm, set()).add(
                ((ln.manufacturer or "").strip().upper(), (ln.description or "").strip().upper())
            )
        for rd in parse_refdes(ln.reference_designators):
            ctx.refdes_counts[rd] = ctx.refdes_counts.get(rd, 0) + 1
    return ctx


def analyze_line_quality_input(inp: LineQualityInput, ctx: QualityContext) -> tuple[bool, str, list[str]]:
    """Return (needs_review, quality_status, reasons) for effective line values."""
    errors: list[str] = []
    warnings: list[str] = []

    cleaned = inp.cleaned_mpn or clean_mpn(inp.mpn)
    original = (inp.mpn or "").strip()
    if not cleaned and not original:
        errors.append("Missing MPN")
    if not (inp.manufacturer or "").strip():
        warnings.append("Missing Manufacturer")
    if not (inp.description or "").strip():
        warnings.append("Missing Description")

    qty = inp.quantity
    qty_missing = qty is None
    try:
        qty_val = Decimal(str(qty)) if qty is not None else None
    except Exception:  # noqa: BLE001
        qty_val = None
        qty_missing = True
    if qty_missing or qty_val is None:
        errors.append("Missing Qty")
    elif qty_val == 0 and not inp.dnp:
        warnings.append("Zero Qty")

    if inp.dnp:
        warnings.append("DNP")

    if cleaned and len(cleaned) < 3:
        warnings.append("Suspicious MPN")

    if cleaned:
        variants = ctx.mpn_variants.get(cleaned, set())
        if ctx.mpn_counts.get(cleaned, 0) > 1 and len(variants) > 1:
            warnings.append("Duplicate MPN with different data")

    for rd in parse_refdes(inp.reference_designators):
        if ctx.refdes_counts.get(rd, 0) > 1:
            warnings.append("Duplicate RefDes")
            break

    reasons = errors + warnings
    if errors:
        status = STATUS_ERROR
    elif warnings:
        status = STATUS_WARNING
    else:
        status = STATUS_OK
    needs_review = bool(errors) or bool(warnings)
    return needs_review, status, reasons


def analyze_bom_line_quality(line: BomLine, ctx: QualityContext) -> tuple[bool, str, list[str]]:
    """Return (needs_review, quality_status, reasons)."""
    inp = LineQualityInput(
        mpn=line.mpn,
        manufacturer=line.manufacturer,
        description=line.description,
        quantity=Decimal(str(line.quantity)) if line.quantity is not None else None,
        dnp=line.dnp,
        cleaned_mpn=line.cleaned_mpn or clean_mpn(line.mpn),
        reference_designators=line.reference_designators,
    )
    return analyze_line_quality_input(inp, ctx)


def reanalyze_bom_version_quality(db: Session, bom_version_id: int) -> list[BomLine]:
    """Recompute quality for all lines using effective values (original + overrides)."""
    from app.services.bom_line_override import effective_values, has_correction, overrides_for_version

    version = db.get(BomVersion, bom_version_id)
    build_qty = version.build_quantity if version else None
    lines = list(
        db.scalars(
            select(BomLine).where(BomLine.bom_version_id == bom_version_id)
        )
    )
    overrides = overrides_for_version(db, bom_version_id)

    inputs: list[LineQualityInput] = []
    for ln in lines:
        eff = effective_values(ln, overrides.get(ln.id))
        qty = eff["quantity"]
        qty_dec = Decimal(str(qty)) if qty is not None else None
        inputs.append(
            LineQualityInput(
                mpn=eff["mpn"],
                manufacturer=eff["manufacturer"],
                description=eff["description"],
                quantity=qty_dec,
                dnp=eff["dnp"],
                cleaned_mpn=eff["cleaned_mpn"],
                reference_designators=ln.reference_designators,
            )
        )

    ctx = build_context_from_inputs(inputs)
    for ln, inp, eff in zip(lines, inputs, [effective_values(l, overrides.get(l.id)) for l in lines]):
        needs_review, status, reasons = analyze_line_quality_input(inp, ctx)
        ov = overrides.get(ln.id)
        if ov and ov.quality_reviewed and status != STATUS_ERROR and not has_correction(ov):
            needs_review = False
        ln.cleaned_mpn = eff["cleaned_mpn"]
        ln.required_qty = compute_required_qty(
            Decimal(str(eff["quantity"])) if eff["quantity"] is not None else None,
            build_qty,
            eff["dnp"],
        )
        ln.needs_review = needs_review
        ln.quality_status = status
        ln.review_reason = "; ".join(reasons) if reasons else None
        ln.is_critical = status == STATUS_ERROR
    db.flush()
    return lines


def compute_quality_summary(lines: list[BomLine]) -> dict:
    total = len(lines)
    ok = warn = err = needs = 0
    missing_mpn = missing_mfr = missing_desc = missing_qty = dnp = 0
    dup_mpn = dup_refdes = 0
    score = 100.0
    for ln in lines:
        reasons = ln.review_reason or ""
        if ln.quality_status == STATUS_ERROR:
            err += 1
        elif ln.quality_status == STATUS_WARNING:
            warn += 1
        else:
            ok += 1
        if ln.needs_review:
            needs += 1
        if "Missing MPN" in reasons:
            missing_mpn += 1
        if "Missing Manufacturer" in reasons:
            missing_mfr += 1
        if "Missing Description" in reasons:
            missing_desc += 1
        if "Missing Qty" in reasons:
            missing_qty += 1
        if ln.dnp:
            dnp += 1
        if "Duplicate MPN" in reasons:
            dup_mpn += 1
        if "Duplicate RefDes" in reasons:
            dup_refdes += 1

        # Score: -5 per error line, -2 per warning line, but DNP-only warning -0.5.
        if ln.quality_status == STATUS_ERROR:
            score -= 5
        elif ln.quality_status == STATUS_WARNING:
            non_dnp = [r for r in reasons.split("; ") if r and r != "DNP"]
            score -= 0.5 if not non_dnp else 2

    score = max(0, min(100, round(score)))
    return {
        "total_lines": total,
        "ok_count": ok,
        "warning_count": warn,
        "error_count": err,
        "needs_review_count": needs,
        "missing_mpn_count": missing_mpn,
        "missing_manufacturer_count": missing_mfr,
        "missing_description_count": missing_desc,
        "missing_qty_count": missing_qty,
        "dnp_count": dnp,
        "duplicate_mpn_count": dup_mpn,
        "duplicate_refdes_count": dup_refdes,
        "quality_score": score,
    }


def line_to_quality_dict(line: BomLine) -> dict:
    """Serialize a BOM line (legacy — prefer bom_line_override.line_to_quality_dict)."""
    return {
        "line_id": line.id,
        "line_number": line.line_no,
        "original_mpn": line.mpn,
        "cleaned_mpn": line.cleaned_mpn,
        "manufacturer": line.manufacturer,
        "original_description": line.description,
        "qty_per_assembly": float(line.quantity) if line.quantity is not None else None,
        "required_qty": float(line.required_qty) if line.required_qty is not None else None,
        "reference_designators": line.reference_designators,
        "footprint": line.footprint,
        "value_text": line.value,
        "is_dnp": line.dnp,
        "quality_status": line.quality_status,
        "needs_review": line.needs_review,
        "review_reason": line.review_reason,
        "notes": line.notes,
    }
