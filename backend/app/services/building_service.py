from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Building, Project
from app.schemas.building import BuildingCreate, BuildingUpdate


def create_building(
    company_id: UUID,
    project_id: UUID,
    building: BuildingCreate,
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

    new_building = Building(
        **building.model_dump(),
        project_id=project_id,
    )

    db.add(new_building)
    db.commit()
    db.refresh(new_building)

    return new_building


def update_building(
    company_id: UUID,
    project_id: UUID,
    building_id: UUID,
    building: BuildingUpdate,
    db: Session,
):
    # Make sure project belongs to this company
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

    # Find building and make sure it belongs to this project
    existing_building = db.scalar(
        select(Building).where(
            Building.id == building_id,
            Building.project_id == project_id,
        )
    )

    if existing_building is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Building not found",
        )

    update_data = building.model_dump(
        exclude_unset=True
    )

    for field, value in update_data.items():
        setattr(
            existing_building,
            field,
            value,
        )

    db.commit()
    db.refresh(existing_building)

    return existing_building



def get_project_buildings(
    company_id: UUID,
    project_id: UUID,
    db: Session,
):
    # Verify that the project belongs to this company
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

    buildings = db.scalars(
        select(Building)
        .where(
            Building.project_id == project_id
        )
        .order_by(
            Building.created_at.desc()
        )
    ).all()

    return buildings

def get_building_details(
    company_id: UUID,
    project_id: UUID,
    building_id: UUID,
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

    # Verify building belongs to project
    building = db.scalar(
        select(Building).where(
            Building.id == building_id,
            Building.project_id == project_id,
        )
    )

    if building is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Building not found",
        )

    return building