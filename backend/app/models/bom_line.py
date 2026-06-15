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
    # PCB / SMT assembly BOM fields.
    footprint: Mapped[str | None] = mapped_column(String(120))
    value: Mapped[str | None] = mapped_column(String(120))
    supplier_part_number: Mapped[str | None] = mapped_column(String(120))
    dnp: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    notes: Mapped[str | None] = mapped_column(Text)

    # Cleaned MPN + required quantity (qty * build_quantity, 0 if DNP).
    cleaned_mpn: Mapped[str | None] = mapped_column(String(120))
    required_qty: Mapped[float | None] = mapped_column(Numeric(14, 4))

    # Quality analysis results.
    needs_review: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    review_reason: Mapped[str | None] = mapped_column(Text)
    quality_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="ok", server_default="ok"
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
