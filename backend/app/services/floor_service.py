from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Building, Floor, Project
from app.schemas.floor import FloorCreate, FloorUpdate


def create_floor(
    company_id: UUID,
    project_id: UUID,
    building_id: UUID,
    floor: FloorCreate,
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

    # Prevent duplicate floor number in same building
    existing_floor = db.scalar(
        select(Floor).where(
            Floor.building_id == building_id,
            Floor.floor_number == floor.floor_number,
        )
    )

    if existing_floor is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Floor number already exists in this building",
        )

    new_floor = Floor(
        **floor.model_dump(),
        building_id=building_id,
    )

    db.add(new_floor)
    db.commit()
    db.refresh(new_floor)

    return new_floor

def update_floor(
    company_id: UUID,
    project_id: UUID,
    building_id: UUID,
    floor_id: UUID,
    floor: FloorUpdate,
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

    # Verify floor belongs to building
    existing_floor = db.scalar(
        select(Floor).where(
            Floor.id == floor_id,
            Floor.building_id == building_id,
        )
    )

    if existing_floor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Floor not found",
        )

    update_data = floor.model_dump(
        exclude_unset=True
    )

    # If floor_number is being changed,
    # prevent duplicates inside the same building
    if "floor_number" in update_data:
        duplicate_floor = db.scalar(
            select(Floor).where(
                Floor.building_id == building_id,
                Floor.floor_number == update_data["floor_number"],
                Floor.id != floor_id,
            )
        )

        if duplicate_floor is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Floor number already exists in this building",
            )

    for field, value in update_data.items():
        setattr(
            existing_floor,
            field,
            value,
        )

    db.commit()
    db.refresh(existing_floor)

    return existing_floor


def get_building_floors(
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

    floors = db.scalars(
        select(Floor)
        .where(
            Floor.building_id == building_id
        )
        .order_by(
            Floor.floor_number.asc()
        )
    ).all()

    return floors

def get_floor_details(
    company_id: UUID,
    project_id: UUID,
    building_id: UUID,
    floor_id: UUID,
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

    # Verify floor belongs to building
    floor = db.scalar(
        select(Floor).where(
            Floor.id == floor_id,
            Floor.building_id == building_id,
        )
    )

    if floor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Floor not found",
        )

    return floor