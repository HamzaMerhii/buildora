from sqlalchemy import func, select

from app.models import ConstructionStage
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Project

def get_project_or_404(
    company_id,
    project_id,
    db,
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

    return project

def create_stage(
    company_id,
    project_id,
    stage,
    db,
):
    get_project_or_404(
        company_id,
        project_id,
        db,
    )

    max_order = db.scalar(
        select(
            func.max(
                ConstructionStage.order_index
            )
        ).where(
            ConstructionStage.project_id == project_id
        )
    )

    next_order = (
        0 if max_order is None else max_order + 1
    )

    new_stage = ConstructionStage(
        **stage.model_dump(),
        project_id=project_id,
        order_index=next_order,
    )

    db.add(new_stage)
    db.commit()
    db.refresh(new_stage)

    return new_stage


def list_stages(
    company_id,
    project_id,
    db,
):
    get_project_or_404(
        company_id,
        project_id,
        db,
    )

    list_stages= db.scalars(
        select(ConstructionStage)
        .where(
            ConstructionStage.project_id == project_id
        )
        .order_by(
            ConstructionStage.order_index.asc()
        )
    ).all()

    return list_stages


def update_stage(
    company_id,
    project_id,
    stage_id,
    stage,
    db,
):
    get_project_or_404(
        company_id,
        project_id,
        db,
    )

    existing_stage = db.scalar(
        select(ConstructionStage).where(
            ConstructionStage.id == stage_id,
            ConstructionStage.project_id == project_id,
        )
    )

    if existing_stage is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stage not found",
        )

    update_data = stage.model_dump(
        exclude_unset=True
    )

    for field, value in update_data.items():
        setattr(
            existing_stage,
            field,
            value,
        )

    db.commit()
    db.refresh(existing_stage)

    return existing_stage

def delete_stage(
    company_id,
    project_id,
    stage_id,
    db,
):
    get_project_or_404(
        company_id,
        project_id,
        db,
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
            detail="Stage not found",
        )

    db.delete(stage)
    db.commit()
def reorder_stages(
    company_id,
    project_id,
    payload,
    db: Session,
):
    # Verify project exists and belongs to company
    get_project_or_404(
        company_id,
        project_id,
        db,
    )

    # Get all project stages
    existing_stages = db.scalars(
        select(ConstructionStage)
        .where(
            ConstructionStage.project_id == project_id
        )
    ).all()

    if not existing_stages:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No stages found for this project",
        )

    stages_by_id = {
        stage.id: stage
        for stage in existing_stages
    }

    existing_stage_ids = set(
        stages_by_id.keys()
    )

    submitted_stage_ids = {
        item.stage_id
        for item in payload.stages
    }

    # Check that every submitted stage belongs
    # to this project.
    invalid_stage_ids = (
        submitted_stage_ids
        - existing_stage_ids
    )

    if invalid_stage_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "One or more stages do not belong "
                "to this project"
            ),
        )

    # Reordering should contain every project stage.
    if submitted_stage_ids != existing_stage_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "All project stages must be included "
                "when reordering"
            ),
        )

    try:
        # ------------------------------
        # Phase 1: temporary positions
        # ------------------------------

        # Find a safe range above every existing
        # and requested order_index.
        highest_index = max(
            [
                stage.order_index
                for stage in existing_stages
            ]
            + [
                item.order_index
                for item in payload.stages
            ]
        )

        temporary_start = highest_index + 1

        for offset, stage in enumerate(existing_stages):
            stage.order_index = (
                temporary_start + offset
            )

        # IMPORTANT:
        # Actually write temporary indexes
        # before assigning final indexes.
        db.flush()

        # ------------------------------
        # Phase 2: final positions
        # ------------------------------

        for item in payload.stages:
            stage = stages_by_id[item.stage_id]

            stage.order_index = item.order_index

        db.commit()

    except Exception:
        db.rollback()
        raise

    return db.scalars(
        select(ConstructionStage)
        .where(
            ConstructionStage.project_id == project_id
        )
        .order_by(
            ConstructionStage.order_index.asc()
        )
    ).all()