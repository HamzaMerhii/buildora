from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.dependencies.permissions import require_project_manager
from app.models import User
from app.schemas.land_record import (
    LandRecordCreate,
    LandRecordResponse,
    LandRecordUpdate,
)
from app.services.land_record_service import get_land_record, update_land_record


router = APIRouter(
    prefix="/companies/{company_id}/projects/{project_id}/land-record",
    tags=["Land Records"],
)


@router.patch(
    "/",
    response_model=LandRecordResponse,
    status_code=status.HTTP_200_OK,
)
def update_existing_land_record(
    company_id: UUID,
    project_id: UUID,
    land_record: LandRecordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_project_manager),
):
    return update_land_record(
        company_id=company_id,
        project_id=project_id,
        land_record=land_record,
        db=db,
    )

@router.get(
    "/",
    response_model=LandRecordResponse,
    status_code=status.HTTP_200_OK,
)
def get_project_land_record(
    company_id: UUID,
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_project_manager),
):
    return get_land_record(
        company_id=company_id,
        project_id=project_id,
        db=db,
    )