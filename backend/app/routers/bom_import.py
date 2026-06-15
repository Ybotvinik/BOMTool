from __future__ import annotations

from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user_id
from app.models import BomLine, BomVersion, Project
from app.schemas.bom_import import BomImportCommit, BomImportResult, BomPreview
from app.services.activity import log_activity
from app.services.bom_parser import parse_table, suggest_mapping
from app.services.file_storage import get_file_storage

router = APIRouter(prefix="/bom-import", tags=["bom_import"])

PREVIEW_ROWS = 10


@router.post("/preview", response_model=BomPreview)
async def preview_bom(file: UploadFile = File(...)) -> BomPreview:
    """Parse an uploaded Excel/CSV file and return a preview + suggested mapping.

    The file is persisted via FileStorageService so the subsequent /commit call
    can re-read it without a second upload.
    """
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        headers, rows = parse_table(content, file.filename or "upload.xlsx")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not parse file: {exc}")

    if not headers:
        raise HTTPException(status_code=400, detail="No header row found")

    storage = get_file_storage()
    stored = storage.save(content, file.filename or "upload.xlsx", subdir="bom-imports")

    return BomPreview(
        file_path=stored.path,
        file_name=stored.file_name,
        columns=headers,
        rows=rows[:PREVIEW_ROWS],
        total_rows=len(rows),
        suggested_mapping=suggest_mapping(headers),
    )


def _to_decimal(value: str) -> Decimal | None:
    value = (value or "").strip().replace(",", "").replace("$", "")
    if not value:
        return None
    try:
        return Decimal(value)
    except (InvalidOperation, ValueError):
        return None


def _to_bool(value: str) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "y", "כן", "critical"}


@router.post("/commit", response_model=BomImportResult)
def commit_bom(
    payload: BomImportCommit,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> BomImportResult:
    """Create a BOM version and its lines from a previously previewed file."""
    project = db.get(Project, payload.project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    storage = get_file_storage()
    try:
        content = storage.read(payload.file_path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Uploaded file not found; re-upload")

    headers, rows = parse_table(content, payload.file_path)
    col_index = {h: i for i, h in enumerate(headers)}
    mapping = payload.mapping

    def cell(row: list[str], field: str) -> str:
        column = mapping.get(field)
        if not column or column not in col_index:
            return ""
        idx = col_index[column]
        return row[idx] if idx < len(row) else ""

    version = BomVersion(
        project_id=payload.project_id,
        version_label=payload.version_label,
        status=payload.status,
        source=payload.source,
        is_active=payload.set_active,
        created_by_id=user_id,
    )
    db.add(version)
    db.flush()

    line_count = 0
    for n, row in enumerate(rows, start=1):
        mpn = cell(row, "mpn")
        description = cell(row, "description")
        if not mpn and not description:
            continue
        qty = _to_decimal(cell(row, "quantity"))
        line = BomLine(
            bom_version_id=version.id,
            line_no=n,
            mpn=mpn or None,
            manufacturer=cell(row, "manufacturer") or None,
            description=description or None,
            quantity=qty if qty is not None else Decimal(0),
            reference_designators=cell(row, "reference_designators") or None,
            unit=cell(row, "unit") or None,
            customer_price=_to_decimal(cell(row, "customer_price")),
            internal_cost=_to_decimal(cell(row, "internal_cost")),
            is_critical=_to_bool(cell(row, "is_critical")),
        )
        db.add(line)
        line_count += 1

    if payload.set_active:
        project.active_version_id = version.id

    db.flush()
    log_activity(
        db,
        user_id=user_id,
        action_type="bom.import",
        project_id=payload.project_id,
        entity_type="bom_version",
        entity_name=version.version_label,
        change_summary=(
            f"Imported BOM '{version.version_label}' with {line_count} lines "
            f"from '{payload.file_path.split('/')[-1]}'"
        ),
        commit=False,
    )
    db.commit()
    db.refresh(version)

    return BomImportResult(
        bom_version_id=version.id,
        line_count=line_count,
        project_id=payload.project_id,
        version_label=version.version_label,
    )
