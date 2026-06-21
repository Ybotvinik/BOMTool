"""card build_quantity and NEW/ACTIVE/DONE statuses

Revision ID: j3k4l5m6n7o8
Revises: i2j3k4l5m6n7
Create Date: 2026-06-21 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "j3k4l5m6n7o8"
down_revision: Union[str, None] = "i2j3k4l5m6n7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "project_cards",
        sa.Column("build_quantity", sa.Integer(), server_default="1", nullable=False),
    )
    op.execute(
        """
        UPDATE project_cards pc
        SET build_quantity = COALESCE(NULLIF(p.build_quantity, 0), 1)
        FROM projects p
        WHERE p.id = pc.project_id
        """
    )

    op.execute(
        """
        UPDATE projects
        SET status = CASE
            WHEN LOWER(status) IN ('active', 'in review', 'quoting') THEN 'ACTIVE'
            WHEN LOWER(status) = 'archived' THEN 'DONE'
            WHEN status IN ('NEW', 'ACTIVE', 'DONE') THEN status
            ELSE 'NEW'
        END
        """
    )
    op.execute(
        """
        UPDATE project_cards
        SET status = CASE
            WHEN LOWER(status) = 'active' THEN 'ACTIVE'
            WHEN LOWER(status) = 'archived' THEN 'DONE'
            WHEN status IN ('NEW', 'ACTIVE', 'DONE') THEN status
            ELSE 'NEW'
        END
        """
    )

    op.alter_column("projects", "status", server_default="NEW")
    op.alter_column("project_cards", "status", server_default="NEW")


def downgrade() -> None:
    op.execute(
        """
        UPDATE projects
        SET status = CASE
            WHEN status = 'ACTIVE' THEN 'Active'
            WHEN status = 'DONE' THEN 'Archived'
            ELSE 'Active'
        END
        """
    )
    op.execute(
        """
        UPDATE project_cards
        SET status = CASE
            WHEN status = 'ACTIVE' THEN 'Active'
            WHEN status = 'DONE' THEN 'Archived'
            ELSE 'Active'
        END
        """
    )
    op.alter_column("projects", "status", server_default="Active")
    op.alter_column("project_cards", "status", server_default="Active")
    op.drop_column("project_cards", "build_quantity")
