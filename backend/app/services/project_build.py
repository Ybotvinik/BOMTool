"""Project build quantity propagation to active BOM versions."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import BomVersion, Project
from app.services.bom_quality import reanalyze_bom_version_quality


def effective_build_quantity(project: Project, version: BomVersion | None) -> int:
    if version and version.build_quantity and version.build_quantity > 0:
        return version.build_quantity
    if project.build_quantity and project.build_quantity > 0:
        return project.build_quantity
    return 1


def refresh_active_bom_quantities(db: Session, project: Project) -> BomVersion | None:
    """Sync active BOM version build qty from project and recompute required_qty / quality."""
    if project.active_version_id is None:
        return None
    version = db.get(BomVersion, project.active_version_id)
    if version is None:
        return None
    version.build_quantity = project.build_quantity
    db.flush()
    reanalyze_bom_version_quality(db, version.id)
    return version
