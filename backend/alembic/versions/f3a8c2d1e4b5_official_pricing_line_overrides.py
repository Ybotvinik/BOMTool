"""official pricing line overrides for workbench selections

Revision ID: f3a8c2d1e4b5
Revises: e7f2a9b4c1d6
Create Date: 2026-06-17 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f3a8c2d1e4b5"
down_revision: Union[str, None] = "e7f2a9b4c1d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "official_pricing_line_overrides",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("bom_version_id", sa.Integer(), nullable=False),
        sa.Column("bom_line_id", sa.Integer(), nullable=False),
        sa.Column("search_mpn_override", sa.String(length=120), nullable=True),
        sa.Column("selected_source_type", sa.String(length=20), nullable=True),
        sa.Column("selected_supplier", sa.String(length=20), nullable=True),
        sa.Column("selected_supplier_part_number", sa.String(length=120), nullable=True),
        sa.Column("manual_supplier_name", sa.String(length=120), nullable=True),
        sa.Column("manual_supplier_part_number", sa.String(length=120), nullable=True),
        sa.Column("manual_unit_price", sa.Numeric(14, 4), nullable=True),
        sa.Column("manual_currency", sa.String(length=8), nullable=True),
        sa.Column("manual_stock", sa.Numeric(14, 4), nullable=True),
        sa.Column("manual_lead_time", sa.String(length=80), nullable=True),
        sa.Column("user_selected", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "manually_approved_possible_match",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("updated_by_user_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["bom_line_id"], ["bom_lines.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["bom_version_id"], ["bom_versions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "project_id",
            "bom_version_id",
            "bom_line_id",
            name="uq_official_pricing_line_override",
        ),
    )


def downgrade() -> None:
    op.drop_table("official_pricing_line_overrides")
