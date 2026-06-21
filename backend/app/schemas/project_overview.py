"""Schemas for project overview (card / batch scope)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class OverviewBatch(BaseModel):
    id: int
    batch_label: str | None = None
    version_label: str
    version_name: str | None = None
    status: str
    build_quantity: int | None = None
    bom_items_count: int = 0
    is_project_active: bool = False


class OverviewCard(BaseModel):
    id: int
    name: str
    board_name: str | None = None
    status: str
    build_quantity: int
    batches: list[OverviewBatch] = Field(default_factory=list)


class ProjectOverviewContext(BaseModel):
    customer_id: int
    customer_name: str
    project_id: int
    project_name: str
    project_code: str
    project_status: str
    active_version_id: int | None = None
    cards: list[OverviewCard] = Field(default_factory=list)
