"""official supplier pricing tables

Revision ID: e7f2a9b4c1d6
Revises: d4e8f1a2b3c4
Create Date: 2026-06-16 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e7f2a9b4c1d6"
down_revision: Union[str, None] = "d4e8f1a2b3c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "official_supplier_queries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("bom_version_id", sa.Integer(), nullable=False),
        sa.Column("supplier", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column("started_by_user_id", sa.Integer(), nullable=True),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("total_lines", sa.Integer(), server_default="0", nullable=False),
        sa.Column("matched_lines", sa.Integer(), server_default="0", nullable=False),
        sa.Column("missing_lines", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_mock", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.ForeignKeyConstraint(["bom_version_id"], ["bom_versions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["started_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "official_supplier_price_results",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("query_id", sa.Integer(), nullable=False),
        sa.Column("bom_line_id", sa.Integer(), nullable=False),
        sa.Column("supplier", sa.String(length=20), nullable=False),
        sa.Column("original_mpn", sa.String(length=120), nullable=True),
        sa.Column("searched_mpn", sa.String(length=120), nullable=True),
        sa.Column("manufacturer", sa.String(length=120), nullable=True),
        sa.Column("supplier_part_number", sa.String(length=120), nullable=True),
        sa.Column("supplier_product_url", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("currency", sa.String(length=8), nullable=True),
        sa.Column("unit_price", sa.Numeric(precision=14, scale=4), nullable=True),
        sa.Column("price_break_qty", sa.Numeric(precision=14, scale=4), nullable=True),
        sa.Column("required_qty", sa.Numeric(precision=14, scale=4), nullable=True),
        sa.Column("available_qty", sa.Numeric(precision=14, scale=4), nullable=True),
        sa.Column("lead_time", sa.String(length=80), nullable=True),
        sa.Column("lifecycle_status", sa.String(length=40), nullable=True),
        sa.Column("is_exact_match", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "match_status",
            sa.String(length=20),
            server_default="not_found",
            nullable=False,
        ),
        sa.Column("match_reason", sa.Text(), nullable=True),
        sa.Column("raw_response_json", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["bom_line_id"], ["bom_lines.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["query_id"], ["official_supplier_queries.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_official_supplier_price_results_bom_line",
        "official_supplier_price_results",
        ["bom_line_id"],
    )

    op.create_table(
        "official_price_snapshots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("bom_version_id", sa.Integer(), nullable=False),
        sa.Column("snapshot_name", sa.String(length=160), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=40), server_default="Active", nullable=False),
        sa.Column("is_mock", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.ForeignKeyConstraint(["bom_version_id"], ["bom_versions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "official_price_lines",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("snapshot_id", sa.Integer(), nullable=False),
        sa.Column("bom_line_id", sa.Integer(), nullable=False),
        sa.Column("selected_supplier", sa.String(length=20), nullable=True),
        sa.Column("selected_supplier_part_number", sa.String(length=120), nullable=True),
        sa.Column("official_source", sa.String(length=40), nullable=True),
        sa.Column("official_unit_price", sa.Numeric(precision=14, scale=4), nullable=True),
        sa.Column("official_extended_price", sa.Numeric(precision=14, scale=4), nullable=True),
        sa.Column("required_qty", sa.Numeric(precision=14, scale=4), nullable=True),
        sa.Column("availability_status", sa.String(length=40), nullable=True),
        sa.Column("lead_time", sa.String(length=80), nullable=True),
        sa.Column(
            "pricing_status",
            sa.String(length=20),
            server_default="missing_price",
            nullable=False,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["bom_line_id"], ["bom_lines.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["snapshot_id"], ["official_price_snapshots.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("official_price_lines")
    op.drop_table("official_price_snapshots")
    op.drop_index("ix_official_supplier_price_results_bom_line", "official_supplier_price_results")
    op.drop_table("official_supplier_price_results")
    op.drop_table("official_supplier_queries")
