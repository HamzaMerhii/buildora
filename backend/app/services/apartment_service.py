from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    Project,
    Building,
    Floor,
    Apartment,
    ApartmentImage,
)
from app.schemas.apartment import ApartmentCreate, ApartmentUpdate


def create_apartment(
    company_id: UUID,
    project_id: UUID,
    building_id: UUID,
    floor_id: UUID,
    apartment: ApartmentCreate,
    db: Session,
    image_urls: list[str] | None = None,
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

    # Prevent duplicate unit number inside same floor
    existing_apartment = db.scalar(
        select(Apartment).where(
            Apartment.floor_id == floor_id,
            Apartment.unit_number == apartment.unit_number,
        )
    )

    if existing_apartment is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unit number already exists on this floor",
        )

    new_apartment = Apartment(
        **apartment.model_dump(),
        floor_id=floor_id,
    )

    db.add(new_apartment)
    db.flush()

    for image_url in image_urls or []:
        db.add(
            ApartmentImage(
                apartment_id=new_apartment.id,
                image_url=image_url,
            )
        )

    db.commit()
    db.refresh(new_apartment)

    return new_apartment

def update_apartment(
    company_id: UUID,
    project_id: UUID,
    building_id: UUID,
    floor_id: UUID,
    apartment_id: UUID,
    apartment: ApartmentUpdate,
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

    # Verify apartment belongs to floor
    existing_apartment = db.scalar(
        select(Apartment).where(
            Apartment.id == apartment_id,
            Apartment.floor_id == floor_id,
        )
    )

    if existing_apartment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Apartment not found",
        )

    update_data = apartment.model_dump(
        exclude_unset=True
    )

    # If unit_number changes, prevent duplicates
    if "unit_number" in update_data:
        duplicate_apartment = db.scalar(
            select(Apartment).where(
                Apartment.floor_id == floor_id,
                Apartment.unit_number == update_data["unit_number"],
                Apartment.id != apartment_id,
            )
        )

        if duplicate_apartment is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unit number already exists on this floor",
            )

    for field, value in update_data.items():
        setattr(
            existing_apartment,
            field,
            value,
        )

    db.commit()
    db.refresh(existing_apartment)

    return existing_apartment



def get_floor_apartments(
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

    apartments = db.scalars(
        select(Apartment)
        .where(
            Apartment.floor_id == floor_id
        )
        .options(selectinload(Apartment.images))
        .order_by(
            Apartment.unit_number.asc()
        )
    ).all()

    return apartments


def get_apartment_details(
    company_id: UUID,
    project_id: UUID,
    building_id: UUID,
    floor_id: UUID,
    apartment_id: UUID,
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

    apartment = db.scalar(
        select(Apartment)
        .where(
            Apartment.id == apartment_id,
            Apartment.floor_id == floor_id,
        )
        .options(selectinload(Apartment.images))
    )

    if apartment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Apartment not found",
        )

    return apartment


def add_images_to_apartment(
    company_id: UUID,
    project_id: UUID,
    building_id: UUID,
    floor_id: UUID,
    apartment_id: UUID,
    image_urls: list[str],
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

    # Verify apartment belongs to floor
    apartment = db.scalar(
        select(Apartment)
        .options(
            selectinload(Apartment.images)
        )
        .where(
            Apartment.id == apartment_id,
            Apartment.floor_id == floor_id,
        )
    )

    if apartment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Apartment not found",
        )

    for image_url in image_urls:
        db.add(
            ApartmentImage(
                apartment_id=apartment.id,
                image_url=image_url,
            )
        )

    db.commit()

    apartment = db.scalar(
        select(Apartment)
        .options(
            selectinload(Apartment.images)
        )
        .where(
            Apartment.id == apartment_id
        )
    )

    return apartment


def remove_apartment_image(
    company_id: UUID,
    project_id: UUID,
    building_id: UUID,
    floor_id: UUID,
    apartment_id: UUID,
    image_id: UUID,
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

    # Verify apartment belongs to floor
    apartment = db.scalar(
        select(Apartment).where(
            Apartment.id == apartment_id,
            Apartment.floor_id == floor_id,
        )
    )

    if apartment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Apartment not found",
        )

    # IMPORTANT:
    # image must belong to this apartment
    apartment_image = db.scalar(
        select(ApartmentImage).where(
            ApartmentImage.id == image_id,
            ApartmentImage.apartment_id == apartment_id,
        )
    )

    if apartment_image is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Apartment image not found",
        )

    db.delete(apartment_image)
    db.commit()