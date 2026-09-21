from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.dependencies.permissions import require_project_manager,require_company_member
from app.models import User
from app.schemas.floor import (
    FloorCreate,
    FloorResponse,
    FloorUpdate,
)
from app.services.floor_service import (create_floor, update_floor,get_building_floors,get_floor_details)


router = APIRouter(
    prefix="/companies/{company_id}/projects/{project_id}/buildings/{building_id}/floors",
    tags=["Floors"],
)


@router.post(
    "/",
    response_model=FloorResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_floor(
    company_id: UUID,
    project_id: UUID,
    building_id: UUID,
    floor: FloorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_project_manager),
):
    return create_floor(
        company_id=company_id,
        project_id=project_id,
        building_id=building_id,
        floor=floor,
        db=db,
    )

@router.patch(
    "/{floor_id}",
    response_model=FloorResponse,
    status_code=status.HTTP_200_OK,
)
def update_existing_floor(
    company_id: UUID,
    project_id: UUID,
    building_id: UUID,
    floor_id: UUID,
    floor: FloorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_project_manager),
):
    return update_floor(
        company_id=company_id,
        project_id=project_id,
        building_id=building_id,
        floor_id=floor_id,
        floor=floor,
        db=db,
    )


@router.get(
    "/",
    response_model=list[FloorResponse],
)
def list_floors(
    company_id: UUID,
    project_id: UUID,
    building_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_company_member),
):
    return get_building_floors(
        company_id=company_id,
        project_id=project_id,
        building_id=building_id,
        db=db,
    )

@router.get(
    "/{floor_id}",
    response_model=FloorResponse,
    status_code=status.HTTP_200_OK,
)
def get_floor(
    company_id: UUID,
    project_id: UUID,
    building_id: UUID,
    floor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_company_member),
):
    return get_floor_details(
        company_id=company_id,
        project_id=project_id,
        building_id=building_id,
        floor_id=floor_id,
        db=db,
    )