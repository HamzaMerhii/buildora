from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.dependencies.permissions import require_site_management, require_company_member
from app.models import User
from app.schemas.task import TaskCreate, TaskResponse, TaskUpdate
from app.services.task_service import (create_task, get_stage_tasks, update_task,get_task_details,delete_task)


router = APIRouter(
    prefix=(
        "/companies/{company_id}"
        "/projects/{project_id}"
        "/stages/{stage_id}"
        "/tasks"
    ),
    tags=["Tasks"],
)


@router.post(
    "/",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_task(
    company_id: UUID,
    project_id: UUID,
    stage_id: UUID,
    task: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_site_management),
):
    return create_task(
        company_id=company_id,
        project_id=project_id,
        stage_id=stage_id,
        task=task,
        db=db,
    )

@router.get(
    "/",
    response_model=list[TaskResponse],
)
def list_tasks(
    company_id: UUID,
    project_id: UUID,
    stage_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_company_member),
):
    return get_stage_tasks(
        company_id=company_id,
        project_id=project_id,
        stage_id=stage_id,
        db=db,
    )
@router.patch(
    "/{task_id}",
    response_model=TaskResponse,
    status_code=status.HTTP_200_OK,
)
def update_existing_task(
    company_id: UUID,
    project_id: UUID,
    stage_id: UUID,
    task_id: UUID,
    task: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_site_management),
):
    return update_task(
        company_id=company_id,
        project_id=project_id,
        stage_id=stage_id,
        task_id=task_id,
        task=task,
        db=db,
    )


@router.get(
    "/{task_id}",
    response_model=TaskResponse,
)
def get_task(
    company_id: UUID,
    project_id: UUID,
    stage_id: UUID,
    task_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_company_member),
):
    return get_task_details(
        company_id=company_id,
        project_id=project_id,
        stage_id=stage_id,
        task_id=task_id,
        db=db,
    )

@router.delete(
    "/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_task(
    company_id: UUID,
    project_id: UUID,
    stage_id: UUID,
    task_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_site_management),
):
    delete_task(
        company_id=company_id,
        project_id=project_id,
        stage_id=stage_id,
        task_id=task_id,
        db=db,
    )