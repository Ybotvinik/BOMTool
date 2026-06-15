"""Shared FastAPI dependencies."""

from __future__ import annotations

from fastapi import Header


def get_current_user_id(x_user_id: int | None = Header(default=None)) -> int | None:
    """Mock authentication.

    The frontend "current user selector" sends the chosen user id in the
    ``X-User-Id`` header. In a future iteration this is replaced by Google
    Workspace login. Returns ``None`` when no user is selected.
    """
    return x_user_id
