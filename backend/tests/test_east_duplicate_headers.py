"""Link quote files repeat Vendor / Unit Price USD for a second source block."""

from __future__ import annotations

import io

from openpyxl import Workbook

from app.services.bom_parser import uniquify_headers
from app.services.east_quotes.link_parser import parse_east_with_mapping, parse_link_xlsx


def _link_workbook() -> bytes:
    wb = Workbook()
    ws = wb.active
    assert ws is not None
    ws.title = "UpAIr"
    ws.append(["Board Name", "ARISENCE"])
    ws.append([])
    ws.append(
        [
            "Quantity",
            "Designator",
            "Manufacturer Part Number",
            "Vendor",
            "QTY",
            "Unit Price USD",
            "Total in USD",
            "Vendor",
            "QTY",
            "Unit Price USD",
            "Total in USD",
        ]
    )
    ws.append(
        [39, "C1", "CGA2B3X7R1E104K050BB", "Link", 500, 0.004, 2.0, "Mouser", 20, 10.3, 206]
    )
    ws.append([1, "C6", "CC0402JRNPO9BN100", "Link", 100, 0.003, 0.3, None, None, None, None])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_uniquify_headers_suffixes_duplicates() -> None:
    assert uniquify_headers(["Vendor", "Unit Price USD", "Vendor", "Unit Price USD"]) == [
        "Vendor",
        "Unit Price USD",
        "Vendor (2)",
        "Unit Price USD (2)",
    ]


def test_parse_link_xlsx_uses_first_unit_price_block() -> None:
    parsed = parse_link_xlsx(_link_workbook(), "link.xlsx")
    assert len(parsed.lines) == 2
    assert parsed.lines[0].vendor == "Link"
    assert parsed.lines[0].unit_price == 0.004
    assert parsed.lines[1].unit_price == 0.003


def test_mapping_plain_unit_price_usd_uses_first_block() -> None:
    parsed = parse_east_with_mapping(
        _link_workbook(),
        "link.xlsx",
        header_row_index=2,
        column_mapping={
            "mpn": "Manufacturer Part Number",
            "unit_price": "Unit Price USD",
            "vendor": "Vendor",
        },
    )
    assert parsed.lines[0].unit_price == 0.004
    assert parsed.lines[0].vendor == "Link"
    assert parsed.lines[1].unit_price == 0.003


def test_mapping_can_select_second_price_block() -> None:
    parsed = parse_east_with_mapping(
        _link_workbook(),
        "link.xlsx",
        header_row_index=2,
        column_mapping={
            "mpn": "Manufacturer Part Number",
            "unit_price": "Unit Price USD (2)",
            "vendor": "Vendor (2)",
        },
    )
    assert parsed.lines[0].unit_price == 10.3
    assert parsed.lines[0].vendor == "Mouser"
    assert parsed.lines[1].unit_price is None
