from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user_id
from app.models import Project
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.services.activity import log_activity

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectRead])
def list_projects(db: Session = Depends(get_db)) -> list[Project]:
    return list(db.scalars(select(Project).order_by(Project.id)))


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


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: int, db: Session = Depends(get_db)) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    log_activity(
        db,
        user_id=user_id,
        action_type="project.update",
        project_id=project.id,
        entity_type="project",
        entity_name=project.name,
        change_summary=f"Updated project '{project.name}'",
    )
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> None:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    name = project.name
    db.delete(project)
    db.commit()
    log_activity(
        db,
        user_id=user_id,
        action_type="project.delete",
        entity_type="project",
        entity_name=name,
        change_summary=f"Deleted project '{name}'",
    )
