"""Default cards/batches to ACTIVE and normalize legacy statuses

Revision ID: k4l5m6n7o8p9
Revises: j3k4l5m6n7o8
Create Date: 2026-07-13 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "k4l5m6n7o8p9"
down_revision: Union[str, None] = "j3k4l5m6n7o8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE project_cards
        SET status = CASE
            WHEN status = 'DONE' OR LOWER(status) = 'archived' THEN 'DONE'
            WHEN status IN ('NEW', 'ACTIVE', 'DONE') THEN
                CASE WHEN status = 'NEW' THEN 'ACTIVE' ELSE status END
            WHEN LOWER(status) IN ('active', 'draft', 'in review', 'quoting') THEN 'ACTIVE'
            ELSE 'ACTIVE'
        END
        """
    )
    op.execute(
        """
        UPDATE bom_versions
        SET status = 'ACTIVE'
        WHERE is_active = true
          AND status NOT IN ('ACTIVE', 'DONE')
        """
    )
    op.execute(
        """
        UPDATE bom_versions
        SET status = 'ACTIVE'
        WHERE imported_at IS NOT NULL
          AND LOWER(status) IN ('draft', 'active', 'in review', 'quoting')
        """
    )
    op.alter_column("project_cards", "status", server_default="ACTIVE")


def downgrade() -> None:
    op.alter_column("project_cards", "status", server_default="NEW")
