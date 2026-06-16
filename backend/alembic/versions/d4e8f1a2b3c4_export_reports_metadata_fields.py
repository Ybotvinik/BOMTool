"""export_reports metadata fields

Revision ID: d4e8f1a2b3c4
Revises: c113a98924db
Create Date: 2026-06-16 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e8f1a2b3c4"
down_revision: Union[str, None] = "c113a98924db"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "export_reports",
        sa.Column("bom_version_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "export_reports",
        sa.Column("pricing_snapshot_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "export_reports",
        sa.Column("file_name", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "export_reports",
        sa.Column(
            "is_customer_safe",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.create_foreign_key(
        "fk_export_reports_bom_version_id",
        "export_reports",
        "bom_versions",
        ["bom_version_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_export_reports_pricing_snapshot_id",
        "export_reports",
        "pricing_snapshots",
        ["pricing_snapshot_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_export_reports_pricing_snapshot_id", "export_reports", type_="foreignkey"
    )
    op.drop_constraint(
        "fk_export_reports_bom_version_id", "export_reports", type_="foreignkey"
    )
    op.drop_column("export_reports", "is_customer_safe")
    op.drop_column("export_reports", "file_name")
    op.drop_column("export_reports", "pricing_snapshot_id")
    op.drop_column("export_reports", "bom_version_id")
