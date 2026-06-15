from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class BomVersion(Base):
    """A versioned snapshot of a project's Bill of Materials."""

    __tablename__ = "bom_versions"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    version_label: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="Draft", nullable=False)
    source: Mapped[str | None] = mapped_column(String(80))
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Revision / source metadata detected from the uploaded BOM file.
    version_name: Mapped[str | None] = mapped_column(String(80))
    revision_code: Mapped[str | None] = mapped_column(String(40))
    source_file_name: Mapped[str | None] = mapped_column(String(255))
    source_doc_number: Mapped[str | None] = mapped_column(String(120))
    board_name: Mapped[str | None] = mapped_column(String(160))
    revised_date: Mapped[str | None] = mapped_column(String(40))
    bom_type: Mapped[str | None] = mapped_column(String(40))
    build_quantity: Mapped[int | None] = mapped_column(Integer)
    imported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    imported_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
