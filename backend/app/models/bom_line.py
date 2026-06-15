from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class BomLine(Base):
    """A single component line within a BOM version."""

    __tablename__ = "bom_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    bom_version_id: Mapped[int] = mapped_column(
        ForeignKey("bom_versions.id", ondelete="CASCADE"), nullable=False
    )
    line_no: Mapped[int | None] = mapped_column(Integer)
    mpn: Mapped[str | None] = mapped_column(String(120))
    manufacturer: Mapped[str | None] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)
    quantity: Mapped[float] = mapped_column(Numeric(14, 4), default=0, nullable=False)
    reference_designators: Mapped[str | None] = mapped_column(Text)
    unit: Mapped[str | None] = mapped_column(String(20))
    customer_price: Mapped[float | None] = mapped_column(Numeric(14, 4))
    internal_cost: Mapped[float | None] = mapped_column(Numeric(14, 4))
    is_critical: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
