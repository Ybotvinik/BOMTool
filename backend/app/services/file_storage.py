"""File storage abstraction.

MVP uses local disk. The interface is intentionally storage-agnostic so a
future ``GoogleSharedDriveStorage`` can be dropped in without touching callers.
"""

from __future__ import annotations

import os
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.config import get_settings


@dataclass
class StoredFile:
    path: str
    file_name: str
    size_bytes: int


class FileStorageService(ABC):
    """Abstract storage backend."""

    @abstractmethod
    def save(self, content: bytes, file_name: str, subdir: str = "") -> StoredFile:
        ...

    @abstractmethod
    def read(self, path: str) -> bytes:
        ...

    @abstractmethod
    def delete(self, path: str) -> None:
        ...


class LocalFileStorage(FileStorageService):
    """Stores files on the local filesystem under ``base_dir``."""

    def __init__(self, base_dir: str) -> None:
        self.base_dir = base_dir
        os.makedirs(self.base_dir, exist_ok=True)

    def _full_path(self, path: str) -> str:
        return os.path.join(self.base_dir, path)

    def save(self, content: bytes, file_name: str, subdir: str = "") -> StoredFile:
        safe_name = f"{uuid.uuid4().hex}_{os.path.basename(file_name)}"
        rel_path = os.path.join(subdir, safe_name) if subdir else safe_name
        full_path = self._full_path(rel_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "wb") as fh:
            fh.write(content)
        return StoredFile(path=rel_path, file_name=file_name, size_bytes=len(content))

    def read(self, path: str) -> bytes:
        with open(self._full_path(path), "rb") as fh:
            return fh.read()

    def delete(self, path: str) -> None:
        full_path = self._full_path(path)
        if os.path.exists(full_path):
            os.remove(full_path)


def get_file_storage() -> FileStorageService:
    """Factory that returns the configured storage backend."""
    settings = get_settings()
    # Future: branch on settings.file_storage_backend == "google_drive".
    return LocalFileStorage(settings.local_storage_dir)
