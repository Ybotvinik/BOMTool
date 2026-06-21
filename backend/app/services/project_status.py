"""Project / card lifecycle statuses and automatic project sync."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Project, ProjectCard

PROJECT_STATUS_NEW = "NEW"
PROJECT_STATUS_ACTIVE = "ACTIVE"
PROJECT_STATUS_DONE = "DONE"

CARD_STATUS_NEW = "NEW"
CARD_STATUS_ACTIVE = "ACTIVE"
CARD_STATUS_DONE = "DONE"

PROJECT_STATUSES = frozenset({PROJECT_STATUS_NEW, PROJECT_STATUS_ACTIVE, PROJECT_STATUS_DONE})
CARD_STATUSES = frozenset({CARD_STATUS_NEW, CARD_STATUS_ACTIVE, CARD_STATUS_DONE})

_LEGACY_PROJECT_TO_NEW = {
    "active": PROJECT_STATUS_ACTIVE,
    "in review": PROJECT_STATUS_ACTIVE,
    "quoting": PROJECT_STATUS_ACTIVE,
    "archived": PROJECT_STATUS_DONE,
}
_LEGACY_CARD_TO_NEW = {
    "active": CARD_STATUS_ACTIVE,
    "archived": CARD_STATUS_DONE,
}


def normalize_project_status(status: str | None) -> str:
    raw = (status or "").strip()
    if raw in PROJECT_STATUSES:
        return raw
    mapped = _LEGACY_PROJECT_TO_NEW.get(raw.lower())
    return mapped or PROJECT_STATUS_NEW


def normalize_card_status(status: str | None) -> str:
    raw = (status or "").strip()
    if raw in CARD_STATUSES:
        return raw
    mapped = _LEGACY_CARD_TO_NEW.get(raw.lower())
    return mapped or CARD_STATUS_NEW


def sync_project_status_from_cards(db: Session, project: Project) -> None:
    """Derive project status from its cards.

  - Any ACTIVE card → project ACTIVE
  - All cards DONE (and at least one card) → project DONE
  - No ACTIVE cards and at least one NEW card → project NEW
  - No cards → project NEW
    """
    cards = list(
        db.scalars(select(ProjectCard).where(ProjectCard.project_id == project.id))
    )
    if not cards:
        project.status = PROJECT_STATUS_NEW
        return

    statuses = {normalize_card_status(c.status) for c in cards}
    if CARD_STATUS_ACTIVE in statuses:
        project.status = PROJECT_STATUS_ACTIVE
    elif statuses <= {CARD_STATUS_DONE}:
        project.status = PROJECT_STATUS_DONE
    elif CARD_STATUS_NEW in statuses:
        project.status = PROJECT_STATUS_NEW
    else:
        project.status = PROJECT_STATUS_DONE
