"""Project build quantity propagation to BOM versions."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import BomVersion, Project, ProjectCard
from app.services.bom_quality import reanalyze_bom_version_quality


def effective_build_quantity(
    version: BomVersion | None,
    *,
    card: ProjectCard | None = None,
    project: Project | None = None,
) -> int:
    if version and version.build_quantity and version.build_quantity > 0:
        return version.build_quantity
    if card and card.build_quantity and card.build_quantity > 0:
        return card.build_quantity
    if project and project.build_quantity and project.build_quantity > 0:
        return project.build_quantity
    return 1


def refresh_active_bom_quantities(db: Session, project: Project) -> BomVersion | None:
    """Recompute required_qty on the active BOM version from card/batch build qty."""
    if project.active_version_id is None:
        return None
    version = db.get(BomVersion, project.active_version_id)
    if version is None:
        return None
    card = db.get(ProjectCard, version.card_id) if version.card_id else None
    if version.build_quantity is None or version.build_quantity <= 0:
        version.build_quantity = effective_build_quantity(version, card=card, project=project)
    db.flush()
    reanalyze_bom_version_quality(db, version.id)
    return version
