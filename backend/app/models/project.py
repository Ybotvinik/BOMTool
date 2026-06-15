from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.mixins import TimestampMixin


class Project(Base, TimestampMixin):
    """A customer project that carries BOM versions, quotes and pricing."""

    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    build_quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="Active", nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    # Logical pointer to the active BomVersion. Kept as a plain integer to avoid a
    # circular FK with bom_versions; resolved in application code.
    active_version_id: Mapped[int | None] = mapped_column(Integer)
    # Simple soft delete: when set, the project is hidden from listings.
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
