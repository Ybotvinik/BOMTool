"""Official supplier API pricing (Digi-Key, Mouser) — customer-safe reference data."""

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class OfficialSupplierQuery(Base):
    """Tracks a batch fetch of official supplier prices for a BOM version."""

    __tablename__ = "official_supplier_queries"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    bom_version_id: Mapped[int] = mapped_column(
        ForeignKey("bom_versions.id", ondelete="CASCADE"), nullable=False
    )
    supplier: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="pending", server_default="pending", nullable=False
    )
    started_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_message: Mapped[str | None] = mapped_column(Text)
    total_lines: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    matched_lines: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    missing_lines: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    is_mock: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false"), nullable=False
    )


class OfficialSupplierPriceResult(Base):
    """Normalized price result from a supplier API for one BOM line."""

    __tablename__ = "official_supplier_price_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    query_id: Mapped[int] = mapped_column(
        ForeignKey("official_supplier_queries.id", ondelete="CASCADE"), nullable=False
    )
    bom_line_id: Mapped[int] = mapped_column(
        ForeignKey("bom_lines.id", ondelete="CASCADE"), nullable=False
    )
    supplier: Mapped[str] = mapped_column(String(20), nullable=False)
    original_mpn: Mapped[str | None] = mapped_column(String(120))
    searched_mpn: Mapped[str | None] = mapped_column(String(120))
    manufacturer: Mapped[str | None] = mapped_column(String(120))
    supplier_part_number: Mapped[str | None] = mapped_column(String(120))
    supplier_product_url: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    currency: Mapped[str | None] = mapped_column(String(8))
    unit_price: Mapped[float | None] = mapped_column(Numeric(14, 4))
    price_break_qty: Mapped[float | None] = mapped_column(Numeric(14, 4))
    required_qty: Mapped[float | None] = mapped_column(Numeric(14, 4))
    available_qty: Mapped[float | None] = mapped_column(Numeric(14, 4))
    lead_time: Mapped[str | None] = mapped_column(String(80))
    lifecycle_status: Mapped[str | None] = mapped_column(String(40))
    is_exact_match: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false"), nullable=False
    )
    match_status: Mapped[str] = mapped_column(
        String(20), default="not_found", server_default="not_found", nullable=False
    )
    match_reason: Mapped[str | None] = mapped_column(Text)
    raw_response_json: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class OfficialPriceSnapshot(Base):
    """Frozen official/reference pricing for a BOM version (customer-safe)."""

    __tablename__ = "official_price_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    bom_version_id: Mapped[int] = mapped_column(
        ForeignKey("bom_versions.id", ondelete="CASCADE"), nullable=False
    )
    snapshot_name: Mapped[str] = mapped_column(String(160), nullable=False)
    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(40), default="Active", server_default="Active", nullable=False
    )
    is_mock: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false"), nullable=False
    )


class OfficialPriceLine(Base):
    """Selected official price for one BOM line within a snapshot."""

    __tablename__ = "official_price_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    snapshot_id: Mapped[int] = mapped_column(
        ForeignKey("official_price_snapshots.id", ondelete="CASCADE"), nullable=False
    )
    bom_line_id: Mapped[int] = mapped_column(
        ForeignKey("bom_lines.id", ondelete="CASCADE"), nullable=False
    )
    selected_supplier: Mapped[str | None] = mapped_column(String(20))
    selected_supplier_part_number: Mapped[str | None] = mapped_column(String(120))
    official_source: Mapped[str | None] = mapped_column(String(40))
    official_unit_price: Mapped[float | None] = mapped_column(Numeric(14, 4))
    official_extended_price: Mapped[float | None] = mapped_column(Numeric(14, 4))
    required_qty: Mapped[float | None] = mapped_column(Numeric(14, 4))
    availability_status: Mapped[str | None] = mapped_column(String(40))
    lead_time: Mapped[str | None] = mapped_column(String(80))
    pricing_status: Mapped[str] = mapped_column(
        String(20), default="missing_price", server_default="missing_price", nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text)


class OfficialPricingLineOverride(Base):
    """Per-line workbench selection and search overrides (live pricing state)."""

    __tablename__ = "official_pricing_line_overrides"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    bom_version_id: Mapped[int] = mapped_column(
        ForeignKey("bom_versions.id", ondelete="CASCADE"), nullable=False
    )
    bom_line_id: Mapped[int] = mapped_column(
        ForeignKey("bom_lines.id", ondelete="CASCADE"), nullable=False
    )
    search_mpn_override: Mapped[str | None] = mapped_column(String(120))
    selected_source_type: Mapped[str | None] = mapped_column(String(20))
    selected_supplier: Mapped[str | None] = mapped_column(String(20))
    selected_supplier_part_number: Mapped[str | None] = mapped_column(String(120))
    manual_supplier_name: Mapped[str | None] = mapped_column(String(120))
    manual_supplier_part_number: Mapped[str | None] = mapped_column(String(120))
    manual_unit_price: Mapped[float | None] = mapped_column(Numeric(14, 4))
    manual_currency: Mapped[str | None] = mapped_column(String(8))
    manual_stock: Mapped[float | None] = mapped_column(Numeric(14, 4))
    manual_lead_time: Mapped[str | None] = mapped_column(String(80))
    user_selected: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false"), nullable=False
    )
    manually_approved_possible_match: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false"), nullable=False
    )
    note: Mapped[str | None] = mapped_column(Text)
    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    updated_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
