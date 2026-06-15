from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PricingSnapshot(Base):
    """A frozen pricing calculation for a BOM version."""

    __tablename__ = "pricing_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    bom_version_id: Mapped[int | None] = mapped_column(
        ForeignKey("bom_versions.id", ondelete="SET NULL")
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="Draft", nullable=False)
    gross_margin_target: Mapped[float | None] = mapped_column(Numeric(6, 4))
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class PricingLine(Base):
    __tablename__ = "pricing_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    pricing_snapshot_id: Mapped[int] = mapped_column(
        ForeignKey("pricing_snapshots.id", ondelete="CASCADE"), nullable=False
    )
    bom_line_id: Mapped[int | None] = mapped_column(
        ForeignKey("bom_lines.id", ondelete="SET NULL")
    )
    mpn: Mapped[str | None] = mapped_column(String(120))
    quantity: Mapped[float | None] = mapped_column(Numeric(14, 4))
    internal_cost: Mapped[float | None] = mapped_column(Numeric(14, 4))
    customer_price: Mapped[float | None] = mapped_column(Numeric(14, 4))
    gross_margin: Mapped[float | None] = mapped_column(Numeric(6, 4))
