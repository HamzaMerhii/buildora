from math import ceil
from uuid import UUID
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    Project,
    Building,
    Floor,
    Apartment,
    ApartmentImage,
)
from app.models.apartment import ApartmentStatus
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



from math import ceil
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.apartment import Apartment
from app.models.building import Building
from app.models.floor import Floor
from app.models.project import Project


def get_floor_apartments(
    company_id: UUID,
    project_id: UUID,
    building_id: UUID,
    floor_id: UUID,
    db: Session,
    page: int = 1,
    page_size: int = 9,
):
    # =========================================================
    # Pagination safety
    # =========================================================

    if page < 1:
        page = 1

    if page_size < 1:
        page_size = 9

    offset = (page - 1) * page_size

    # =========================================================
    # Verify project belongs to company
    # =========================================================

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

    # =========================================================
    # Verify building belongs to project
    # =========================================================

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

    # =========================================================
    # Verify floor belongs to building
    # =========================================================

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

    # =========================================================
    # Total apartments on this floor
    # =========================================================

    total = db.scalar(
        select(
            func.count(Apartment.id)
        )
        .where(
            Apartment.floor_id == floor_id
        )
    ) or 0

    # =========================================================
    # Paginated apartments
    # =========================================================

    apartments = db.scalars(
        select(Apartment)
        .where(
            Apartment.floor_id == floor_id
        )
        .options(
            selectinload(Apartment.images)
        )
        .order_by(
            Apartment.unit_number.asc()
        )
        .offset(offset)
        .limit(page_size)
    ).all()

    total_pages = (
        ceil(total / page_size)
        if total > 0
        else 0
    )

    return {
        "items": apartments,
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
    }


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


def get_company_apartments(
    company_id: UUID,
    db: Session,
    page: int = 1,
    page_size: int = 10,
    project_id: Optional[UUID] = None,
    building_id: Optional[UUID] = None,
    status: Optional[ApartmentStatus] = None,
    is_public: Optional[bool] = None,
):
    """Company-wide management apartment list in a single SQL query.

    Joins Apartment → Floor → Building → Project and scopes with
    Project.company_id == company_id, so apartments from other
    companies can never leak. Optional project/building/status/
    visibility filters narrow the same scope (a foreign project or
    building id simply matches zero rows).

    Returns (items, total, status_counts) where items are dicts
    matching CompanyApartmentResponse and status_counts covers the
    company/project/building scope ignoring the status/is_public
    filters, so the dashboard availability split stays meaningful.
    """
    if page < 1:
        page = 1
    if page_size < 1:
        page_size = 10
    if page_size > 100:
        page_size = 100
    offset = (page - 1) * page_size

    scope = [Project.company_id == company_id]
    if project_id is not None:
        scope.append(Project.id == project_id)
    if building_id is not None:
        scope.append(Building.id == building_id)

    item_conditions = list(scope)
    if status is not None:
        item_conditions.append(Apartment.status == status)
    if is_public is not None:
        item_conditions.append(Apartment.is_public == is_public)

    # Single aggregate statement serves both numbers: per-status counts
    # over the company/project/building scope, plus the filtered total
    # via FILTER (equal to the old separate COUNT when no extra item
    # filters are present).
    item_extra = item_conditions[len(scope):]
    matched_count = (
        func.count(Apartment.id).filter(*item_extra)
        if item_extra
        else func.count(Apartment.id)
    )
    count_rows = db.execute(
        select(
            Apartment.status,
            func.count(Apartment.id).label("scoped"),
            matched_count.label("matched"),
        )
        .select_from(Apartment)
        .join(Floor, Apartment.floor_id == Floor.id)
        .join(Building, Floor.building_id == Building.id)
        .join(Project, Building.project_id == Project.id)
        .where(*scope)
        .group_by(Apartment.status)
    ).all()
    counts = {"available": 0, "reserved": 0, "sold": 0}
    total = 0
    for value, scoped, matched in count_rows:
        key = value.value if isinstance(value, ApartmentStatus) else str(value)
        if key in counts:
            counts[key] = int(scoped)
        total += int(matched or 0)

    rows = db.execute(
        select(
            Apartment,
            Project.id.label("row_project_id"),
            Project.name.label("row_project_name"),
            Building.id.label("row_building_id"),
            Building.name.label("row_building_name"),
            Floor.name.label("row_floor_name"),
        )
        .select_from(Apartment)
        .join(Floor, Apartment.floor_id == Floor.id)
        .join(Building, Floor.building_id == Building.id)
        .join(Project, Building.project_id == Project.id)
        .where(*item_conditions)
        .options(selectinload(Apartment.images))
        .order_by(
            Project.name.asc(),
            Building.name.asc(),
            Floor.floor_number.asc(),
            Apartment.unit_number.asc(),
            Apartment.id.asc(),
        )
        .offset(offset)
        .limit(page_size)
    ).all()

    items = []
    for apartment, row_project_id, row_project_name, row_building_id, row_building_name, row_floor_name in rows:
        items.append(
            {
                "id": apartment.id,
                "floor_id": apartment.floor_id,
                "unit_number": apartment.unit_number,
                "area_sqm": apartment.area_sqm,
                "bedrooms": apartment.bedrooms,
                "bathrooms": apartment.bathrooms,
                "price": apartment.price,
                "status": apartment.status,
                "is_public": apartment.is_public,
                "description": apartment.description,
                "images": [
                    {"id": image.id, "image_url": image.image_url}
                    for image in (apartment.images or [])
                ],
                "created_at": apartment.created_at,
                "updated_at": apartment.updated_at,
                "project_id": row_project_id,
                "project_name": row_project_name,
                "building_id": row_building_id,
                "building_name": row_building_name,
                "floor_name": row_floor_name,
            }
        )

    total_pages = ceil(total / page_size) if total > 0 else 0

    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
        "status_counts": counts,
    }