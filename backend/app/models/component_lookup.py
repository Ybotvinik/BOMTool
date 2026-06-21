"""Logged ad-hoc official supplier price lookups (single component checks)."""

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
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ComponentPriceLookup(Base):
    """One manual component pricing check across official supplier APIs."""

    __tablename__ = "component_price_lookups"

    id: Mapped[int] = mapped_column(primary_key=True)
    search_mpn: Mapped[str] = mapped_column(String(120), nullable=False)
    cleaned_mpn: Mapped[str | None] = mapped_column(String(120))
    manufacturer_hint: Mapped[str | None] = mapped_column(String(120))
    required_qty: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    is_mock: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false"), nullable=False
    )
    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_checked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    results: Mapped[list["ComponentPriceLookupResult"]] = relationship(
        back_populates="lookup",
        cascade="all, delete-orphan",
        order_by="ComponentPriceLookupResult.supplier",
    )
    project_additions: Mapped[list["ComponentPriceLookupAddition"]] = relationship(
        back_populates="lookup",
        cascade="all, delete-orphan",
        order_by="ComponentPriceLookupAddition.created_at.desc()",
    )


class ComponentPriceLookupResult(Base):
    """Per-supplier result for a component price lookup."""

    __tablename__ = "component_price_lookup_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    lookup_id: Mapped[int] = mapped_column(
        ForeignKey("component_price_lookups.id", ondelete="CASCADE"), nullable=False
    )
    supplier: Mapped[str] = mapped_column(String(20), nullable=False)
    matched_mpn: Mapped[str | None] = mapped_column(String(120))
    manufacturer: Mapped[str | None] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)
    supplier_part_number: Mapped[str | None] = mapped_column(String(120))
    product_url: Mapped[str | None] = mapped_column(Text)
    currency: Mapped[str | None] = mapped_column(String(8))
    unit_price: Mapped[float | None] = mapped_column(Numeric(14, 4))
    price_break_qty: Mapped[float | None] = mapped_column(Numeric(14, 4))
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

    lookup: Mapped[ComponentPriceLookup] = relationship(back_populates="results")


class ComponentPriceLookupAddition(Base):
    """Record of adding a logged lookup result to a project BOM."""

    __tablename__ = "component_price_lookup_additions"

    id: Mapped[int] = mapped_column(primary_key=True)
    lookup_id: Mapped[int] = mapped_column(
        ForeignKey("component_price_lookups.id", ondelete="CASCADE"), nullable=False
    )
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    bom_version_id: Mapped[int] = mapped_column(
        ForeignKey("bom_versions.id", ondelete="CASCADE"), nullable=False
    )
    bom_line_id: Mapped[int] = mapped_column(
        ForeignKey("bom_lines.id", ondelete="CASCADE"), nullable=False
    )
    added_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    lookup: Mapped[ComponentPriceLookup] = relationship(back_populates="project_additions")
