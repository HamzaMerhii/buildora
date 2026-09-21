from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Project,
    ConstructionStage,
    Task,
    TaskUpdate,
    User,
)
from app.schemas.task_update import TaskUpdateCreate


def create_task_update(
    company_id: UUID,
    project_id: UUID,
    stage_id: UUID,
    task_id: UUID,
    task_update: TaskUpdateCreate,
    db: Session,
    current_user: User,
    photo_url: Optional[str] = None,
):
    # Verify project belongs to company
    project = db.scalar(
        select(Project).where(
            Project.id == project_id,
            Project.company_id == company_id,
        )
    )

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Verify stage belongs to project
    stage = db.scalar(
        select(ConstructionStage).where(
            ConstructionStage.id == stage_id,
            ConstructionStage.project_id == project_id,
        )
    )

    if stage is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Construction stage not found",
        )

    # Verify task belongs to stage
    task = db.scalar(
        select(Task).where(
            Task.id == task_id,
            Task.stage_id == stage_id,
        )
    )

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    new_task_update = TaskUpdate(
        task_id=task_id,
        user_id=current_user.id,
        progress_percent=task_update.progress_percent,
        status=task_update.status,
        notes=task_update.notes,
        photo_url=photo_url,
    )

    # Keep the main Task as the current state
    task.progress_percent = task_update.progress_percent
    task.status = task_update.status

    db.add(new_task_update)

    db.commit()

    db.refresh(new_task_update)
    db.refresh(task)

    return new_task_update