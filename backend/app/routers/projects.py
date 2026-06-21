import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user_id
from app.models import ActivityLog, BomVersion, Customer, Project
from app.schemas.activity_log import ActivityLogRead
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.schemas.project_overview import ProjectOverviewContext
from app.schemas.project_workspace import (
    CardBatchCreate,
    CardBatchRead,
    ProjectCardCreate,
    ProjectCardRead,
    WorkspaceResponse,
)
from app.services.activity import log_activity
from app.services.project_overview import build_project_overview
from app.services.project_status import PROJECT_STATUSES, normalize_project_status
from app.services.project_workspace import (
    build_workspace,
    create_card_batch,
    create_project_card,
)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/workspace", response_model=WorkspaceResponse)
def get_projects_workspace(
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> WorkspaceResponse:
    return WorkspaceResponse(**build_workspace(db, q=q))


@router.get("", response_model=list[ProjectRead])
def list_projects(db: Session = Depends(get_db)) -> list[Project]:
    # Soft-deleted projects are excluded from listings.
    stmt = select(Project).where(Project.deleted_at.is_(None)).order_by(Project.id)
    return list(db.scalars(stmt))


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> Project:
    project = Project(**payload.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    log_activity(
        db,
        user_id=user_id,
        action_type="project.create",
        project_id=project.id,
        entity_type="project",
        entity_name=project.name,
        change_summary=f"Created project '{project.name}' ({project.code})",
    )
    return project


@router.post(
    "/{project_id}/cards",
    response_model=ProjectCardRead,
    status_code=status.HTTP_201_CREATED,
)
def post_project_card(
    project_id: int,
    payload: ProjectCardCreate,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> ProjectCardRead:
    try:
        card = create_project_card(
            db,
            project_id=project_id,
            name=payload.name,
            code=payload.code,
            board_name=payload.board_name,
            status=payload.status,
            build_quantity=payload.build_quantity,
            notes=payload.notes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    db.commit()
    db.refresh(card)
    log_activity(
        db,
        user_id=user_id,
        action_type="project_card.create",
        project_id=project_id,
        entity_type="project_card",
        entity_name=card.name,
        change_summary=f"Created card '{card.name}'",
    )
    return ProjectCardRead.model_validate(card)


@router.get("/{project_id}/overview", response_model=ProjectOverviewContext)
def get_project_overview(project_id: int, db: Session = Depends(get_db)) -> ProjectOverviewContext:
    try:
        payload = build_project_overview(db, project_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return ProjectOverviewContext(**payload)


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: int, db: Session = Depends(get_db)) -> Project:
    project = db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/{project_id}/activity", response_model=list[ActivityLogRead])
def project_activity(
    project_id: int,
    limit: int = 20,
    db: Session = Depends(get_db),
) -> list[ActivityLog]:
    project = db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Project not found")
    stmt = (
        select(ActivityLog)
        .where(ActivityLog.project_id == project_id)
        .order_by(ActivityLog.created_at.desc())
        .limit(min(limit, 200))
    )
    return list(db.scalars(stmt))


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> Project:
    project = db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Project not found")

    data = payload.model_dump(exclude_unset=True)
    changes: list[str] = []

    # --- Customer: existing selection or inline creation ---
    if payload.new_customer is not None:
        cname = (payload.new_customer.name or "").strip()
        if not cname:
            raise HTTPException(status_code=400, detail="שם לקוח חדש חסר")
        customer = Customer(name=cname, code=(payload.new_customer.code or "").strip() or None)
        db.add(customer)
        db.flush()
        old_customer = db.get(Customer, project.customer_id)
        old_name = old_customer.name if old_customer else str(project.customer_id)
        if customer.id != project.customer_id:
            changes.append(f"customer changed from '{old_name}' to '{cname}'")
        project.customer_id = customer.id
    elif data.get("customer_id") is not None and data["customer_id"] != project.customer_id:
        new_customer = db.get(Customer, data["customer_id"])
        if new_customer is None:
            raise HTTPException(status_code=400, detail="הלקוח שנבחר לא קיים")
        old_customer = db.get(Customer, project.customer_id)
        old_name = old_customer.name if old_customer else str(project.customer_id)
        changes.append(f"customer changed from '{old_name}' to '{new_customer.name}'")
        project.customer_id = new_customer.id

    # --- Name ---
    if "name" in data:
        new_name = (data["name"] or "").strip()
        if not new_name:
            raise HTTPException(status_code=400, detail="שם פרויקט נדרש")
        if new_name != project.name:
            changes.append("project name changed")
        project.name = new_name

    # --- Project code: required, normalized, unique ---
    if "code" in data:
        new_code = re.sub(r"\s+", " ", (data["code"] or "").strip())
        if not new_code:
            raise HTTPException(status_code=400, detail="קוד פרויקט נדרש")
        if new_code != project.code:
            dup = db.scalar(
                select(Project).where(
                    Project.code == new_code, Project.id != project.id
                )
            )
            if dup is not None:
                raise HTTPException(
                    status_code=409, detail="קוד פרויקט כבר קיים במערכת"
                )
            changes.append("project code changed")
        project.code = new_code

    # --- Status (manual override; card changes auto-sync via project_cards API) ---
    if "status" in data and data["status"]:
        st = normalize_project_status(data["status"])
        if st not in PROJECT_STATUSES:
            raise HTTPException(status_code=400, detail="סטטוס פרויקט לא תקין")
        if st != project.status:
            changes.append("status changed")
        project.status = st

    # --- Description / notes ---
    if "description" in data:
        project.description = data["description"]

    if "drive_folder_url" in data:
        project.drive_folder_url = (data["drive_folder_url"] or "").strip() or None

    if "active_version_id" in data:
        new_vid = data["active_version_id"]
        if new_vid is not None:
            version = db.get(BomVersion, new_vid)
            if version is None or version.project_id != project.id:
                raise HTTPException(status_code=400, detail="גרסת BOM לא תקינה לפרויקט")
        if new_vid != project.active_version_id:
            changes.append("active BOM version changed")
        project.active_version_id = new_vid

    db.commit()
    db.refresh(project)
    log_activity(
        db,
        user_id=user_id,
        action_type="project_updated",
        project_id=project.id,
        entity_type="project",
        entity_name=project.name,
        change_summary=(
            "; ".join(changes) if changes else f"Updated project '{project.name}'"
        ),
    )
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> None:
    project = db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Project not found")
    name = project.name
    # Soft delete: hide from listings, keep related records intact.
    project.deleted_at = datetime.now(timezone.utc)
    db.commit()
    log_activity(
        db,
        user_id=user_id,
        action_type="project.delete",
        project_id=project.id,
        entity_type="project",
        entity_name=name,
        change_summary=f"Deleted project '{name}'",
    )
