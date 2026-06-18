"""East supplier quote fields + workbench east toggle

Revision ID: g7h8i9j0k1l2
Revises: a1b2c3d4e5f6
Create Date: 2026-06-17 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "g7h8i9j0k1l2"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "bom_versions",
        sa.Column(
            "include_east_pricing",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.add_column("supplier_quotes", sa.Column("sheet_name", sa.String(length=120), nullable=True))
    op.add_column("supplier_quotes", sa.Column("board_name", sa.String(length=160), nullable=True))
    op.add_column("supplier_quotes", sa.Column("doc_number", sa.String(length=120), nullable=True))
    op.add_column("supplier_quotes", sa.Column("revised_date", sa.String(length=40), nullable=True))
    op.add_column(
        "supplier_quotes",
        sa.Column("total_price_summary", sa.Numeric(precision=14, scale=4), nullable=True),
    )
    op.add_column(
        "supplier_quotes",
        sa.Column("unit_price_summary", sa.Numeric(precision=14, scale=4), nullable=True),
    )
    op.add_column(
        "supplier_quotes",
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
    )
    op.add_column("supplier_quotes", sa.Column("replaced_quote_id", sa.Integer(), nullable=True))
    op.add_column(
        "supplier_quotes",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_foreign_key(
        "fk_supplier_quotes_replaced_quote_id",
        "supplier_quotes",
        "supplier_quotes",
        ["replaced_quote_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column(
        "supplier_quote_lines",
        sa.Column("quantity", sa.Numeric(precision=14, scale=4), nullable=True),
    )
    op.add_column("supplier_quote_lines", sa.Column("designator", sa.String(length=255), nullable=True))
    op.add_column("supplier_quote_lines", sa.Column("footprint", sa.String(length=120), nullable=True))
    op.add_column("supplier_quote_lines", sa.Column("value", sa.String(length=120), nullable=True))
    op.add_column("supplier_quote_lines", sa.Column("assembly", sa.String(length=40), nullable=True))
    op.add_column("supplier_quote_lines", sa.Column("vendor", sa.String(length=120), nullable=True))
    op.add_column(
        "supplier_quote_lines",
        sa.Column("quoted_qty", sa.Numeric(precision=14, scale=4), nullable=True),
    )
    op.add_column(
        "supplier_quote_lines",
        sa.Column("total_price", sa.Numeric(precision=14, scale=4), nullable=True),
    )
    op.add_column("supplier_quote_lines", sa.Column("brand", sa.String(length=120), nullable=True))
    op.add_column("supplier_quote_lines", sa.Column("supplier_code", sa.String(length=80), nullable=True))
    op.add_column(
        "supplier_quote_lines",
        sa.Column("is_dnp", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.add_column(
        "supplier_quote_lines",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("supplier_quote_lines", "updated_at")
    op.drop_column("supplier_quote_lines", "is_dnp")
    op.drop_column("supplier_quote_lines", "supplier_code")
    op.drop_column("supplier_quote_lines", "brand")
    op.drop_column("supplier_quote_lines", "total_price")
    op.drop_column("supplier_quote_lines", "quoted_qty")
    op.drop_column("supplier_quote_lines", "vendor")
    op.drop_column("supplier_quote_lines", "assembly")
    op.drop_column("supplier_quote_lines", "value")
    op.drop_column("supplier_quote_lines", "footprint")
    op.drop_column("supplier_quote_lines", "designator")
    op.drop_column("supplier_quote_lines", "quantity")

    op.drop_constraint("fk_supplier_quotes_replaced_quote_id", "supplier_quotes", type_="foreignkey")
    op.drop_column("supplier_quotes", "updated_at")
    op.drop_column("supplier_quotes", "replaced_quote_id")
    op.drop_column("supplier_quotes", "is_active")
    op.drop_column("supplier_quotes", "unit_price_summary")
    op.drop_column("supplier_quotes", "total_price_summary")
    op.drop_column("supplier_quotes", "revised_date")
    op.drop_column("supplier_quotes", "doc_number")
    op.drop_column("supplier_quotes", "board_name")
    op.drop_column("supplier_quotes", "sheet_name")
    op.drop_column("bom_versions", "include_east_pricing")
