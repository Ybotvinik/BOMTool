from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SupplierQuote(Base):
    """A quote received from a supplier (e.g. China pricing, official reps)."""

    __tablename__ = "supplier_quotes"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    supplier_name: Mapped[str] = mapped_column(String(160), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="USD", nullable=False)
    quote_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(40), default="Draft", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class SupplierQuoteLine(Base):
    __tablename__ = "supplier_quote_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    supplier_quote_id: Mapped[int] = mapped_column(
        ForeignKey("supplier_quotes.id", ondelete="CASCADE"), nullable=False
    )
    mpn: Mapped[str | None] = mapped_column(String(120))
    manufacturer: Mapped[str | None] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)
    moq: Mapped[int | None] = mapped_column(Integer)
    lead_time_days: Mapped[int | None] = mapped_column(Integer)
    unit_price: Mapped[float | None] = mapped_column(Numeric(14, 4))
    stock: Mapped[int | None] = mapped_column(Integer)
    currency: Mapped[str | None] = mapped_column(String(8))
    notes: Mapped[str | None] = mapped_column(Text)
