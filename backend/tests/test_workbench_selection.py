"""Workbench line selection: manual vs east in combined mode."""

from __future__ import annotations

from types import SimpleNamespace

from app.services.suppliers.base import SOURCE_TYPE_EAST
from app.services.suppliers.workbench import (
    SOURCE_TYPE_MANUAL,
    _find_east_offer,
    _is_manual_override,
    resolve_line_selection,
)


def _override(**kwargs):
    base = dict(
        manual_unit_price=1.4,
        manual_supplier_name="GlinTech",
        manual_supplier_part_number=None,
        manual_currency="USD",
        manual_stock=None,
        manual_lead_time=None,
        note="GlinTech",
        user_selected=True,
        selected_source_type=SOURCE_TYPE_MANUAL,
        selected_supplier=None,
        manually_approved_possible_match=False,
    )
    base.update(kwargs)
    return SimpleNamespace(**base)


def _bom_line():
    return SimpleNamespace(id=1, dnp=False, quantity=1, required_qty=40000)


def _east_offers():
    return [
        {
            "supplier": "link",
            "supplier_display": "Link",
            "unit_price": 0.72,
            "stock": 100,
            "currency": "USD",
            "match_status": "exact_mpn",
        }
    ]


class TestManualVsEastSelection:
    def test_manual_active_when_selected_source_is_manual(self) -> None:
        sel = resolve_line_selection(
            bl=_bom_line(),
            req_qty=40000,
            results_map={},
            override=_override(selected_source_type=SOURCE_TYPE_MANUAL),
            east_offers=_east_offers(),
            include_east=True,
        )
        assert sel.selected_source_type == SOURCE_TYPE_MANUAL
        assert sel.unit_price == 1.4

    def test_east_wins_after_user_selects_east_over_saved_manual(self) -> None:
        sel = resolve_line_selection(
            bl=_bom_line(),
            req_qty=40000,
            results_map={},
            override=_override(
                selected_source_type=SOURCE_TYPE_EAST,
                selected_supplier="link",
            ),
            east_offers=_east_offers(),
            include_east=True,
        )
        assert sel.selected_source_type == SOURCE_TYPE_EAST
        assert sel.unit_price == 0.72
        assert sel.source == "Link"

    def test_east_not_used_in_official_only_mode(self) -> None:
        sel = resolve_line_selection(
            bl=_bom_line(),
            req_qty=40000,
            results_map={},
            override=_override(
                selected_source_type=SOURCE_TYPE_EAST,
                selected_supplier="link",
            ),
            east_offers=_east_offers(),
            include_east=False,
        )
        assert sel.selected_source_type != SOURCE_TYPE_EAST
        assert sel.source == "TBD"

    def test_saved_manual_not_auto_applied_without_explicit_selection(self) -> None:
        sel = resolve_line_selection(
            bl=_bom_line(),
            req_qty=40000,
            results_map={},
            override=_override(selected_source_type=None),
            east_offers=_east_offers(),
            include_east=False,
        )
        assert sel.selected_source_type != SOURCE_TYPE_MANUAL
        assert sel.unit_price is None

    def test_manual_override_false_when_east_selected(self) -> None:
        o = _override(selected_source_type=SOURCE_TYPE_EAST, selected_supplier="link")
        assert _is_manual_override(o) is False

    def test_find_east_offer_normalizes_supplier_key(self) -> None:
        offer = _find_east_offer(_east_offers(), "Link")
        assert offer is not None
        assert offer["unit_price"] == 0.72
