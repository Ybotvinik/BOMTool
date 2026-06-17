from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class BomLineOverride(Base):
    """User corrections and quality review acceptance for a BOM line.

    Original uploaded values remain on ``bom_lines``; overrides store effective
    corrections without mutating the source row.
    """

    __tablename__ = "bom_line_overrides"

    id: Mapped[int] = mapped_column(primary_key=True)
    bom_line_id: Mapped[int] = mapped_column(
        ForeignKey("bom_lines.id", ondelete="CASCADE"), nullable=False, unique=True
    )

    # Snapshot of uploaded values (set once on first correction/review).
    original_mpn: Mapped[str | None] = mapped_column(String(120))
    original_manufacturer: Mapped[str | None] = mapped_column(String(120))
    original_description: Mapped[str | None] = mapped_column(Text)
    original_quantity: Mapped[float | None] = mapped_column(Numeric(14, 4))
    original_dnp: Mapped[bool | None] = mapped_column(Boolean)

    # Effective corrections (NULL = use original from bom_lines snapshot).
    mpn: Mapped[str | None] = mapped_column(String(120))
    manufacturer: Mapped[str | None] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)
    quantity: Mapped[float | None] = mapped_column(Numeric(14, 4))
    dnp: Mapped[bool | None] = mapped_column(Boolean)
    correction_note: Mapped[str | None] = mapped_column(Text)

    quality_reviewed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    quality_review_note: Mapped[str | None] = mapped_column(Text)
    quality_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    quality_reviewed_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

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
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
