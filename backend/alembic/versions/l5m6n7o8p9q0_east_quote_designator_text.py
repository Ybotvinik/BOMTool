"""Widen east quote designator column for long refdes lists

Revision ID: l5m6n7o8p9q0
Revises: k4l5m6n7o8p9
Create Date: 2026-07-13 13:15:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "l5m6n7o8p9q0"
down_revision: Union[str, None] = "k4l5m6n7o8p9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "supplier_quote_lines",
        "designator",
        existing_type=sa.String(length=255),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "supplier_quote_lines",
        "designator",
        existing_type=sa.Text(),
        type_=sa.String(length=255),
        existing_nullable=True,
    )
