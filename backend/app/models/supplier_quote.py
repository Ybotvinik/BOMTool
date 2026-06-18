from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SupplierQuote(Base):
    """Internal East/China supplier quote — never exposed in customer exports."""

    __tablename__ = "supplier_quotes"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    bom_version_id: Mapped[int | None] = mapped_column(
        ForeignKey("bom_versions.id", ondelete="SET NULL")
    )
    quote_name: Mapped[str | None] = mapped_column(String(160))
    supplier_name: Mapped[str] = mapped_column(String(160), nullable=False)
    source_type: Mapped[str] = mapped_column(
        String(40), default="east", server_default="east", nullable=False
    )
    currency: Mapped[str] = mapped_column(String(8), default="USD", nullable=False)
    quote_date: Mapped[date | None] = mapped_column(Date)
    valid_until: Mapped[date | None] = mapped_column(Date)
    source_file_name: Mapped[str | None] = mapped_column(String(255))
    sheet_name: Mapped[str | None] = mapped_column(String(120))
    board_name: Mapped[str | None] = mapped_column(String(160))
    doc_number: Mapped[str | None] = mapped_column(String(120))
    revised_date: Mapped[str | None] = mapped_column(String(40))
    total_price_summary: Mapped[float | None] = mapped_column(Numeric(14, 4))
    unit_price_summary: Mapped[float | None] = mapped_column(Numeric(14, 4))
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true"), nullable=False
    )
    replaced_quote_id: Mapped[int | None] = mapped_column(
        ForeignKey("supplier_quotes.id", ondelete="SET NULL")
    )
    status: Mapped[str] = mapped_column(
        String(40), default="active", server_default="active", nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text)
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    uploaded_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class SupplierQuoteLine(Base):
    __tablename__ = "supplier_quote_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    supplier_quote_id: Mapped[int] = mapped_column(
        ForeignKey("supplier_quotes.id", ondelete="CASCADE"), nullable=False
    )
    line_number: Mapped[int | None] = mapped_column(Integer)
    quantity: Mapped[float | None] = mapped_column(Numeric(14, 4))
    designator: Mapped[str | None] = mapped_column(String(255))
    mpn: Mapped[str | None] = mapped_column(String(120))
    quoted_mpn: Mapped[str | None] = mapped_column(String(120))
    cleaned_quoted_mpn: Mapped[str | None] = mapped_column(String(120))
    manufacturer: Mapped[str | None] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)
    footprint: Mapped[str | None] = mapped_column(String(120))
    value: Mapped[str | None] = mapped_column(String(120))
    supplier_part_number: Mapped[str | None] = mapped_column(String(120))
    assembly: Mapped[str | None] = mapped_column(String(40))
    vendor: Mapped[str | None] = mapped_column(String(120))
    moq: Mapped[int | None] = mapped_column(Integer)
    lead_time_days: Mapped[int | None] = mapped_column(Integer)
    lead_time: Mapped[str | None] = mapped_column(String(40))
    unit_price: Mapped[float | None] = mapped_column(Numeric(14, 4))
    quoted_qty: Mapped[float | None] = mapped_column(Numeric(14, 4))
    total_price: Mapped[float | None] = mapped_column(Numeric(14, 4))
    stock: Mapped[int | None] = mapped_column(Integer)
    available_qty: Mapped[int | None] = mapped_column(Integer)
    currency: Mapped[str | None] = mapped_column(String(8))
    brand: Mapped[str | None] = mapped_column(String(120))
    supplier_code: Mapped[str | None] = mapped_column(String(80))
    is_dnp: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false"), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text)
    matched_bom_line_id: Mapped[int | None] = mapped_column(
        ForeignKey("bom_lines.id", ondelete="SET NULL")
    )
    match_status: Mapped[str] = mapped_column(
        String(20), default="not_matched", server_default="not_matched", nullable=False
    )
    match_confidence: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    match_reason: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
