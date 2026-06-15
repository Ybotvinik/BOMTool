from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ProcurementFile(Base):
    """A procurement order file prepared for a supplier."""

    __tablename__ = "procurement_files"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    supplier_name: Mapped[str | None] = mapped_column(String(160))
    file_name: Mapped[str | None] = mapped_column(String(255))
    file_path: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(40), default="Draft", nullable=False)
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ProcurementFileLine(Base):
    __tablename__ = "procurement_file_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    procurement_file_id: Mapped[int] = mapped_column(
        ForeignKey("procurement_files.id", ondelete="CASCADE"), nullable=False
    )
    mpn: Mapped[str | None] = mapped_column(String(120))
    manufacturer: Mapped[str | None] = mapped_column(String(120))
    quantity: Mapped[float | None] = mapped_column(Numeric(14, 4))
    unit_price: Mapped[float | None] = mapped_column(Numeric(14, 4))
    lead_time_days: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
