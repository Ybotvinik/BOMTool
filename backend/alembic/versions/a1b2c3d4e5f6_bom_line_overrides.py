"""bom line overrides for quality corrections and review

Revision ID: a1b2c3d4e5f6
Revises: f3a8c2d1e4b5
Create Date: 2026-06-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "f3a8c2d1e4b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "bom_line_overrides",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("bom_line_id", sa.Integer(), nullable=False),
        sa.Column("original_mpn", sa.String(length=120), nullable=True),
        sa.Column("original_manufacturer", sa.String(length=120), nullable=True),
        sa.Column("original_description", sa.Text(), nullable=True),
        sa.Column("original_quantity", sa.Numeric(precision=14, scale=4), nullable=True),
        sa.Column("original_dnp", sa.Boolean(), nullable=True),
        sa.Column("mpn", sa.String(length=120), nullable=True),
        sa.Column("manufacturer", sa.String(length=120), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("quantity", sa.Numeric(precision=14, scale=4), nullable=True),
        sa.Column("dnp", sa.Boolean(), nullable=True),
        sa.Column("correction_note", sa.Text(), nullable=True),
        sa.Column(
            "quality_reviewed",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("quality_review_note", sa.Text(), nullable=True),
        sa.Column("quality_reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("quality_reviewed_by_user_id", sa.Integer(), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["quality_reviewed_by_user_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("bom_line_id"),
    )


def downgrade() -> None:
    op.drop_table("bom_line_overrides")
