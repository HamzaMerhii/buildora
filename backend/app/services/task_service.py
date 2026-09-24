from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Project,
    ConstructionStage,
    CompanyMembership,
    Party,
    Task,
)
from app.schemas.task import TaskCreate, TaskUpdate


def create_task(
    company_id: UUID,
    project_id: UUID,
    stage_id: UUID,
    task: TaskCreate,
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

    # Validate assigned user
    if task.assigned_to is not None:
        membership = db.scalar(
            select(CompanyMembership).where(
                CompanyMembership.user_id == task.assigned_to,
                CompanyMembership.company_id == company_id,
                CompanyMembership.is_active.is_(True),
            )
        )

        if membership is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assigned user is not an active member of this company",
            )

    # Validate assigned party
    if task.party_id is not None:
        party = db.scalar(
            select(Party).where(
                Party.id == task.party_id,
                Party.company_id == company_id,
            )
        )

        if party is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Party does not belong to this company",
            )

    # Validate dates
    if (
        task.start_date is not None
        and task.due_date is not None
        and task.due_date < task.start_date
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Due date cannot be before start date",
        )

    new_task = Task(
        **task.model_dump(),
        stage_id=stage_id,
    )

    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    return new_task


def get_stage_tasks(
    company_id: UUID,
    project_id: UUID,
    stage_id: UUID,
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

    tasks = db.scalars(
        select(Task)
        .where(
            Task.stage_id == stage_id
        )
        .order_by(
            Task.created_at.desc()
        )
    ).all()

    return tasks


def get_task_details(
    company_id: UUID,
    project_id: UUID,
    stage_id: UUID,
    task_id: UUID,
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

    return task


def update_task(
    company_id: UUID,
    project_id: UUID,
    stage_id: UUID,
    task_id: UUID,
    task: TaskUpdate,
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
    existing_task = db.scalar(
        select(Task).where(
            Task.id == task_id,
            Task.stage_id == stage_id,
        )
    )

    if existing_task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    update_data = task.model_dump(
        exclude_unset=True
    )

    # Validate assigned user if changed
    if "assigned_to" in update_data:
        assigned_user_id = update_data["assigned_to"]

        if assigned_user_id is not None:
            membership = db.scalar(
                select(CompanyMembership).where(
                    CompanyMembership.user_id == assigned_user_id,
                    CompanyMembership.company_id == company_id,
                    CompanyMembership.is_active.is_(True),
                )
            )

            if membership is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Assigned user is not an active member of this company",
                )

    # Validate party if changed
    if "party_id" in update_data:
        party_id = update_data["party_id"]

        if party_id is not None:
            party = db.scalar(
                select(Party).where(
                    Party.id == party_id,
                    Party.company_id == company_id,
                )
            )

            if party is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Party does not belong to this company",
                )

    # Get final dates after update
    start_date = update_data.get(
        "start_date",
        existing_task.start_date,
    )

    due_date = update_data.get(
        "due_date",
        existing_task.due_date,
    )

    # Validate dates
    if (
        start_date is not None
        and due_date is not None
        and due_date < start_date
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Due date cannot be before start date",
        )

    for field, value in update_data.items():
        setattr(
            existing_task,
            field,
            value,
        )

    db.commit()
    db.refresh(existing_task)

    return existing_task


def delete_task(
    company_id: UUID,
    project_id: UUID,
    stage_id: UUID,
    task_id: UUID,
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

    db.delete(task)
    db.commit()