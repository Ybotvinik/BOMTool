"""Safe Mouser Search API diagnostic — prints normalized fields only (no API key)."""

from __future__ import annotations

import json
import sys

from app.services.suppliers.official_pricing import test_supplier_search


def main() -> int:
    mpn = sys.argv[1] if len(sys.argv) > 1 else "GRM155R71H104ME14D"
    try:
        result = test_supplier_search(supplier="mouser", mpn=mpn, required_qty=100)
    except Exception as exc:
        print(json.dumps({"error": str(exc)}, indent=2))
        return 1

    out = {
        "supplier": result.get("supplier"),
        "supplier_part_number": result.get("supplier_part_number"),
        "matched_mpn": result.get("matched_mpn"),
        "manufacturer": result.get("manufacturer"),
        "description": result.get("description"),
        "currency": result.get("currency"),
        "unit_price_for_required_qty": result.get("unit_price_for_required_qty"),
        "price_break_qty": result.get("price_break_qty"),
        "available_qty": result.get("available_qty"),
        "lead_time": result.get("lead_time"),
        "lifecycle_status": result.get("lifecycle_status"),
        "is_exact_match": result.get("is_exact_match"),
        "match_status": result.get("match_status"),
        "mock": result.get("mock"),
    }
    print(json.dumps(out, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
