"""project cards, batches, drive folder url

Revision ID: i2j3k4l5m6n7
Revises: h1i2j3k4l5m6
Create Date: 2026-06-21 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "i2j3k4l5m6n7"
down_revision: Union[str, None] = "h1i2j3k4l5m6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "project_cards",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("code", sa.String(length=60), nullable=True),
        sa.Column("board_name", sa.String(length=160), nullable=True),
        sa.Column("status", sa.String(length=40), server_default="Active", nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.add_column("projects", sa.Column("drive_folder_url", sa.String(length=500), nullable=True))
    op.add_column("bom_versions", sa.Column("card_id", sa.Integer(), nullable=True))
    op.add_column("bom_versions", sa.Column("batch_label", sa.String(length=80), nullable=True))
    op.create_foreign_key(
        "fk_bom_versions_card_id",
        "bom_versions",
        "project_cards",
        ["card_id"],
        ["id"],
        ondelete="SET NULL",
    )

    conn = op.get_bind()
    projects = conn.execute(sa.text("SELECT id, name FROM projects WHERE deleted_at IS NULL")).fetchall()
    for project_id, project_name in projects:
        versions = conn.execute(
            sa.text(
                "SELECT id, board_name, version_label, version_name "
                "FROM bom_versions WHERE project_id = :pid ORDER BY id"
            ),
            {"pid": project_id},
        ).fetchall()
        board_names = sorted(
            {
                (row[1] or "").strip()
                for row in versions
                if row[1] and str(row[1]).strip()
            }
        )
        if board_names:
            card_specs = [(bn, bn) for bn in board_names]
        else:
            card_specs = [(project_name, None)]

        card_ids_by_board: dict[str | None, int] = {}
        for card_name, board_name in card_specs:
            card_id = conn.execute(
                sa.text(
                    "INSERT INTO project_cards (project_id, name, board_name, status) "
                    "VALUES (:pid, :name, :board, 'Active') RETURNING id"
                ),
                {"pid": project_id, "name": card_name, "board": board_name},
            ).scalar_one()
            card_ids_by_board[board_name] = card_id

        default_card_id = next(iter(card_ids_by_board.values()))
        for vid, board_name, version_label, version_name in versions:
            bn = (board_name or "").strip() or None
            card_id = card_ids_by_board.get(bn, default_card_id)
            batch_label = (version_name or version_label or f"מנה {vid}").strip()
            conn.execute(
                sa.text(
                    "UPDATE bom_versions SET card_id = :cid, batch_label = :bl WHERE id = :vid"
                ),
                {"cid": card_id, "bl": batch_label, "vid": vid},
            )


def downgrade() -> None:
    op.drop_constraint("fk_bom_versions_card_id", "bom_versions", type_="foreignkey")
    op.drop_column("bom_versions", "batch_label")
    op.drop_column("bom_versions", "card_id")
    op.drop_column("projects", "drive_folder_url")
    op.drop_table("project_cards")
