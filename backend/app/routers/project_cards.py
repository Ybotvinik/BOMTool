from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user_id
from app.models import Project, ProjectCard
from app.schemas.project_workspace import (
    CardBatchCreate,
    CardBatchRead,
    ProjectCardRead,
    ProjectCardUpdate,
)
from app.services.activity import log_activity
from app.services.project_status import (
    CARD_STATUSES,
    normalize_card_status,
    sync_project_status_from_cards,
)
from app.services.project_workspace import create_card_batch

router = APIRouter(prefix="/project-cards", tags=["project-cards"])


@router.get("/{card_id}", response_model=ProjectCardRead)
def get_project_card(card_id: int, db: Session = Depends(get_db)) -> ProjectCard:
    card = db.get(ProjectCard, card_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


@router.patch("/{card_id}", response_model=ProjectCardRead)
def patch_project_card(
    card_id: int,
    payload: ProjectCardUpdate,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> ProjectCard:
    card = db.get(ProjectCard, card_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    project = db.get(Project, card.project_id)
    if project is None or project.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Project not found")

    data = payload.model_dump(exclude_unset=True)
    changes: list[str] = []

    if "name" in data:
        name = (data["name"] or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="שם כרטיס נדרש")
        if name != card.name:
            changes.append("card name changed")
        card.name = name

    if "code" in data:
        card.code = (data["code"] or "").strip() or None

    if "board_name" in data:
        card.board_name = (data["board_name"] or "").strip() or None

    if "notes" in data:
        card.notes = data["notes"]

    if "build_quantity" in data:
        bq = data["build_quantity"]
        if bq is None or bq <= 0:
            raise HTTPException(status_code=400, detail="כמות להרכבה חייבת להיות מספר חיובי")
        if bq != card.build_quantity:
            changes.append("build quantity changed")
        card.build_quantity = bq

    if "status" in data and data["status"] is not None:
        st = normalize_card_status(data["status"])
        if st not in CARD_STATUSES:
            raise HTTPException(status_code=400, detail="סטטוס כרטיס לא תקין")
        if st != card.status:
            changes.append("card status changed")
        card.status = st

    sync_project_status_from_cards(db, project)
    db.commit()
    db.refresh(card)
    log_activity(
        db,
        user_id=user_id,
        action_type="project_card.update",
        project_id=project.id,
        entity_type="project_card",
        entity_name=card.name,
        change_summary="; ".join(changes) if changes else f"Updated card '{card.name}'",
    )
    return card


@router.post(
    "/{card_id}/batches",
    response_model=CardBatchRead,
    status_code=status.HTTP_201_CREATED,
)
def post_card_batch(
    card_id: int,
    payload: CardBatchCreate,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> CardBatchRead:
    try:
        version = create_card_batch(
            db,
            card_id=card_id,
            batch_label=payload.batch_label,
            build_quantity=payload.build_quantity,
            notes=payload.notes,
            copy_from_version_id=payload.copy_from_version_id,
            set_active=payload.set_active,
            user_id=user_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    db.commit()
    db.refresh(version)
    log_activity(
        db,
        user_id=user_id,
        action_type="card_batch.create",
        project_id=version.project_id,
        entity_type="bom_version",
        entity_name=version.batch_label or version.version_label,
        change_summary=f"Created batch '{version.batch_label}' for card #{card_id}",
    )
    return CardBatchRead.model_validate(version)
