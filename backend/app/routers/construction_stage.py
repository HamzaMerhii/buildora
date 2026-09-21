from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.dependencies.permissions import (
    require_company_member,
    require_project_manager,
)
from app.models import User
from app.schemas.construction_stage import (
    ConstructionStageCreate,
    ConstructionStageUpdate,
    ConstructionStageResponse,
    StageReorderRequest,
)
from app.services.construction_stage_service import (
    create_stage,
    list_stages,
    update_stage,
    delete_stage,
    reorder_stages,
)


router = APIRouter(
    prefix="/companies/{company_id}/projects/{project_id}/stages",
    tags=["Construction Stages"],
)


@router.post(
    "/",
    response_model=ConstructionStageResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_stage(
    company_id: UUID,
    project_id: UUID,
    stage: ConstructionStageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_project_manager),
):
    return create_stage(
        company_id=company_id,
        project_id=project_id,
        stage=stage,
        db=db,
    )


@router.get(
    "/",
    response_model=list[ConstructionStageResponse],
)
def get_stages(
    company_id: UUID,
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_company_member),
):
    return list_stages(
        company_id=company_id,
        project_id=project_id,
        db=db,
    )
@router.patch(
    "/reorder",
    response_model=list[ConstructionStageResponse],
)
def reorder_project_stages(
    company_id: UUID,
    project_id: UUID,
    payload: StageReorderRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_project_manager),
):
    return reorder_stages(
        company_id=company_id,
        project_id=project_id,
        payload=payload,
        db=db,
    )


@router.patch(
    "/{stage_id}",
    response_model=ConstructionStageResponse,
)
def patch_stage(
    company_id: UUID,
    project_id: UUID,
    stage_id: UUID,
    stage: ConstructionStageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_project_manager),
):
    return update_stage(
        company_id=company_id,
        project_id=project_id,
        stage_id=stage_id,
        stage=stage,
        db=db,
    )


@router.delete(
    "/{stage_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_stage(
    company_id: UUID,
    project_id: UUID,
    stage_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_project_manager),
):
    delete_stage(
        company_id=company_id,
        project_id=project_id,
        stage_id=stage_id,
        db=db,
    )