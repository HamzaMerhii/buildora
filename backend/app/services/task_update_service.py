from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select,func
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

    # Store the old project progress
    old_project_progress = project.progress_percent

    # Create task update history
    new_task_update = TaskUpdate(
        task_id=task_id,
        user_id=current_user.id,
        progress_percent=task_update.progress_percent,
        status=task_update.status,
        notes=task_update.notes,
        photo_url=photo_url,
    )

    db.add(new_task_update)

    # Update current task state
    task.progress_percent = task_update.progress_percent
    task.status = task_update.status

    # Flush changes so queries in this transaction see updated task values
    db.flush()

    # Recalculate stage progress
    stage_progress = db.scalar(
        select(
            func.avg(Task.progress_percent)
        ).where(
            Task.stage_id == stage_id
        )
    )

    new_stage_progress = round(
        float(stage_progress or 0)
    )

    stage.progress_percent = new_stage_progress

    db.flush()

    # Recalculate project progress
    project_progress = db.scalar(
        select(
            func.avg(
                ConstructionStage.progress_percent
            )
        ).where(
            ConstructionStage.project_id == project_id
        )
    )

    new_project_progress = round(
        float(project_progress or 0)
    )

    project.progress_percent = new_project_progress

    db.commit()

    db.refresh(new_task_update)
    db.refresh(task)
    db.refresh(stage)
    db.refresh(project)

    return new_task_update

def get_task_updates(
    company_id: UUID,
    project_id: UUID,
    stage_id: UUID,
    task_id: UUID,
    db: Session,
):
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

    updates = db.scalars(
        select(TaskUpdate)
        .where(
            TaskUpdate.task_id == task_id
        )
        .order_by(
            TaskUpdate.created_at.desc()
        )
    ).all()

    return updates

def get_task_update_details(
    company_id: UUID,
    project_id: UUID,
    stage_id: UUID,
    task_id: UUID,
    update_id: UUID,
    db: Session,
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

    # Verify update belongs to task
    task_update = db.scalar(
        select(TaskUpdate).where(
            TaskUpdate.id == update_id,
            TaskUpdate.task_id == task_id,
        )
    )

    if task_update is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task update not found",
        )

    return task_update