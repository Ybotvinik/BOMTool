"""component price lookup log tables

Revision ID: h1i2j3k4l5m6
Revises: g7h8i9j0k1l2
Create Date: 2026-06-19 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "h1i2j3k4l5m6"
down_revision: Union[str, None] = "g7h8i9j0k1l2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "component_price_lookups",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("search_mpn", sa.String(length=120), nullable=False),
        sa.Column("cleaned_mpn", sa.String(length=120), nullable=True),
        sa.Column("manufacturer_hint", sa.String(length=120), nullable=True),
        sa.Column("required_qty", sa.Numeric(precision=14, scale=4), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("is_mock", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "last_checked_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_component_price_lookups_cleaned_mpn",
        "component_price_lookups",
        ["cleaned_mpn"],
    )
    op.create_index(
        "ix_component_price_lookups_created_at",
        "component_price_lookups",
        ["created_at"],
    )

    op.create_table(
        "component_price_lookup_results",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lookup_id", sa.Integer(), nullable=False),
        sa.Column("supplier", sa.String(length=20), nullable=False),
        sa.Column("matched_mpn", sa.String(length=120), nullable=True),
        sa.Column("manufacturer", sa.String(length=120), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("supplier_part_number", sa.String(length=120), nullable=True),
        sa.Column("product_url", sa.Text(), nullable=True),
        sa.Column("currency", sa.String(length=8), nullable=True),
        sa.Column("unit_price", sa.Numeric(precision=14, scale=4), nullable=True),
        sa.Column("price_break_qty", sa.Numeric(precision=14, scale=4), nullable=True),
        sa.Column("available_qty", sa.Numeric(precision=14, scale=4), nullable=True),
        sa.Column("lead_time", sa.String(length=80), nullable=True),
        sa.Column("lifecycle_status", sa.String(length=40), nullable=True),
        sa.Column(
            "is_exact_match",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "match_status",
            sa.String(length=20),
            server_default="not_found",
            nullable=False,
        ),
        sa.Column("match_reason", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["lookup_id"], ["component_price_lookups.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "component_price_lookup_additions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lookup_id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("bom_version_id", sa.Integer(), nullable=False),
        sa.Column("bom_line_id", sa.Integer(), nullable=False),
        sa.Column("added_by_user_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["lookup_id"], ["component_price_lookups.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["bom_version_id"], ["bom_versions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["bom_line_id"], ["bom_lines.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["added_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("component_price_lookup_additions")
    op.drop_table("component_price_lookup_results")
    op.drop_index("ix_component_price_lookups_created_at", table_name="component_price_lookups")
    op.drop_index("ix_component_price_lookups_cleaned_mpn", table_name="component_price_lookups")
    op.drop_table("component_price_lookups")
