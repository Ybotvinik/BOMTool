from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ExportReport(Base):
    """A generated export/report artifact for a project."""

    __tablename__ = "export_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    bom_version_id: Mapped[int | None] = mapped_column(
        ForeignKey("bom_versions.id", ondelete="SET NULL")
    )
    pricing_snapshot_id: Mapped[int | None] = mapped_column(
        ForeignKey("pricing_snapshots.id", ondelete="SET NULL")
    )
    report_type: Mapped[str] = mapped_column(String(60), nullable=False)
    file_name: Mapped[str | None] = mapped_column(String(255))
    file_path: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(40), default="Generated", nullable=False)
    is_customer_safe: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
