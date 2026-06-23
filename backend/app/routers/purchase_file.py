from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.purchase_file import PurchaseFileResponse
from app.services.purchase_file import build_purchase_file

router = APIRouter(prefix="/purchase-file", tags=["purchase_file"])


@router.get("", response_model=PurchaseFileResponse)
def get_purchase_file(
    project_id: int = Query(...),
    bom_version_id: int = Query(...),
    supplier: str = Query("all"),
    include_east: bool | None = Query(None),
    snapshot_id: int | None = Query(None),
    db: Session = Depends(get_db),
) -> PurchaseFileResponse:
    try:
        return build_purchase_file(
            db,
            project_id=project_id,
            bom_version_id=bom_version_id,
            supplier_filter=supplier,
            include_east=include_east,
            snapshot_id=snapshot_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
