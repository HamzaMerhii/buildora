from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.dependencies.permissions import require_project_manager
from app.models.building import Building
from app.schemas.building import BuildingUpdate
from app.models import User
from app.schemas.building import (
    BuildingCreate,
    BuildingResponse,
)
from app.services.building_service import (create_building, update_building, get_project_buildings,get_building_details)


router = APIRouter(
    prefix="/companies/{company_id}/projects/{project_id}/buildings",
    tags=["Buildings"],
)


@router.post(
    "/",
    response_model=BuildingResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_building(
    company_id: UUID,
    project_id: UUID,
    building: BuildingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_project_manager),
):
    return create_building(
        company_id=company_id,
        project_id=project_id,
        building=building,
        db=db,
    )

@router.patch(
    "/{building_id}",
    response_model=BuildingResponse,
    status_code=status.HTTP_200_OK,
)
def update_existing_building(
    company_id: UUID,
    project_id: UUID,
    building_id: UUID,
    building: BuildingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_project_manager),
):
    return update_building(
        company_id=company_id,
        project_id=project_id,
        building_id=building_id,
        building=building,
        db=db,
    )



@router.get(
    "/",
    response_model=list[BuildingResponse],
)
def list_buildings(
    company_id: UUID,
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_project_manager),
):
    return get_project_buildings(
        company_id=company_id,
        project_id=project_id,
        db=db,
    )

@router.get(
    "/{building_id}",
    response_model=BuildingResponse,
    status_code=status.HTTP_200_OK,
)
def get_building(
    company_id: UUID,
    project_id: UUID,
    building_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_project_manager),
):
    return get_building_details(
        company_id=company_id,
        project_id=project_id,
        building_id=building_id,
        db=db,
    )