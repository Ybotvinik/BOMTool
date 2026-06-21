"""Schemas for project cards and workspace tree."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class ProjectCardCreate(BaseModel):
    name: str
    code: str | None = None
    board_name: str | None = None
    status: str = "NEW"
    build_quantity: int = Field(default=1, gt=0)
    notes: str | None = None


class ProjectCardUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    board_name: str | None = None
    status: str | None = None
    build_quantity: int | None = Field(default=None, gt=0)
    notes: str | None = None


class ProjectCardRead(ORMModel):
    id: int
    project_id: int
    name: str
    code: str | None = None
    board_name: str | None = None
    status: str
    build_quantity: int
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


class CardBatchCreate(BaseModel):
    batch_label: str | None = None
    build_quantity: int | None = Field(default=None, gt=0)
    notes: str | None = None
    copy_from_version_id: int | None = None
    set_active: bool = True


class CardBatchRead(ORMModel):
    id: int
    card_id: int | None
    batch_label: str | None
    version_label: str
    version_name: str | None = None
    status: str
    is_active: bool
    build_quantity: int | None = None
    board_name: str | None = None
    imported_at: datetime | None = None
    created_at: datetime


class WorkspaceBatchRow(BaseModel):
    batch_id: int
    batch_label: str
    card_id: int
    card_name: str
    card_board_name: str | None = None
    project_id: int
    project_name: str
    project_code: str
    project_status: str
    batch_status: str = "Draft"
    drive_folder_url: str | None = None
    customer_id: int
    customer_name: str
    bom_version_label: str | None = None
    bom_version_name: str | None = None
    is_active_batch: bool = False
    bom_items_count: int = 0
    opened_at: datetime | None = None
    closed_at: datetime | None = None
    updated_at: datetime | None = None
    updated_by_user_id: int | None = None
    updated_by_name: str | None = None


class WorkspaceTreeCard(BaseModel):
    id: int
    name: str
    code: str | None = None
    board_name: str | None = None
    status: str
    build_quantity: int = 1
    batches: list[WorkspaceBatchRow] = Field(default_factory=list)


class WorkspaceTreeProject(BaseModel):
    id: int
    name: str
    code: str
    status: str
    drive_folder_url: str | None = None
    cards: list[WorkspaceTreeCard] = Field(default_factory=list)


class WorkspaceTreeCustomer(BaseModel):
    id: int
    name: str
    code: str | None = None
    projects: list[WorkspaceTreeProject] = Field(default_factory=list)


class WorkspaceSummary(BaseModel):
    customer_count: int
    project_count: int
    card_count: int
    batch_count: int
    active_projects: int
    in_review_projects: int
    needs_review_total: int


class WorkspaceResponse(BaseModel):
    summary: WorkspaceSummary
    customers: list[WorkspaceTreeCustomer]
    batches: list[WorkspaceBatchRow]
