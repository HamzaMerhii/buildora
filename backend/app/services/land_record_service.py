from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Project, LandRecord
from app.schemas.land_record import LandRecordUpdate


def update_land_record(
    company_id: UUID,
    project_id: UUID,
    land_record: LandRecordUpdate,
    db: Session,
):
    # Make sure the project belongs to this company
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

    existing_land_record = db.scalar(
        select(LandRecord).where(
            LandRecord.project_id == project_id
        )
    )

    if existing_land_record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Land record not found",
        )

    update_data = land_record.model_dump(
        exclude_unset=True
    )

    for field, value in update_data.items():
        setattr(
            existing_land_record,
            field,
            value,
        )

    db.commit()
    db.refresh(existing_land_record)

    return existing_land_record


def get_land_record(
    company_id: UUID,
    project_id: UUID,
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

    land_record = db.scalar(
        select(LandRecord).where(
            LandRecord.project_id == project_id
        )
    )

    if land_record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Land record not found",
        )

    return land_record