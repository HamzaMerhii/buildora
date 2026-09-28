from math import ceil
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.apartment import Apartment, ApartmentStatus
from app.models.apartment_image import ApartmentImage
from app.models.building import Building
from app.models.floor import Floor
from app.models.project import Project
from app.models.lead import Lead, LeadStatus
from app.schemas.public import PublicApartmentInterestCreate
from app.models.company_membership import CompanyMembership, CompanyRole
from app.models.user import User


def get_public_companies(
    db: Session,
):
    apartment_count_subquery = (
        select(
            func.count(Apartment.id)
        )
        .join(
            Floor,
            Apartment.floor_id == Floor.id,
        )
        .join(
            Building,
            Floor.building_id == Building.id,
        )
        .join(
            Project,
            Building.project_id == Project.id,
        )
        .where(
            Project.company_id == Company.id,
            Apartment.is_public.is_(True),
        )
        .correlate(Company)
        .scalar_subquery()
    )

    rows = db.execute(
        select(
            Company.id,
            Company.name,
            Company.logo,
            Company.address,
            Company.phone,
            Company.email,

            apartment_count_subquery.label(
                "apartment_count"
            ),
        )
        .where(
            Company.is_active.is_(True)
        )
        .order_by(
            Company.created_at.desc()
        )
    ).all()

    return [
        {
            "id": company_id,
            "name": name,
            "logo": logo,
            "address": address,
            "phone": phone,
            "email": email,
            "apartment_count": apartment_count,
        }
        for (
            company_id,
            name,
            logo,
            address,
            phone,
            email,
            apartment_count,
        ) in rows
    ]

def get_public_company_details(
    company_id: UUID,
    db: Session,
    page: int = 1,
    page_size: int = 6,
):
    # =========================================================
    # Pagination safety
    # =========================================================

    if page < 1:
        page = 1

    if page_size < 1:
        page_size = 6

    offset = (page - 1) * page_size

    # =========================================================
    # Company
    # =========================================================

    company = db.scalar(
        select(Company).where(
            Company.id == company_id,
            Company.is_active.is_(True),
        )
    )

    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )

    # =========================================================
    # Project count
    # Only projects containing public apartments
    # =========================================================

    project_count = db.scalar(
        select(
            func.count(
                func.distinct(Project.id)
            )
        )
        .join(
            Building,
            Building.project_id == Project.id,
        )
        .join(
            Floor,
            Floor.building_id == Building.id,
        )
        .join(
            Apartment,
            Apartment.floor_id == Floor.id,
        )
        .where(
            Project.company_id == company_id,
            Apartment.is_public.is_(True),
        )
    ) or 0

    # =========================================================
    # Building count
    # Only buildings containing public apartments
    # =========================================================

    building_count = db.scalar(
        select(
            func.count(
                func.distinct(Building.id)
            )
        )
        .join(
            Project,
            Building.project_id == Project.id,
        )
        .join(
            Floor,
            Floor.building_id == Building.id,
        )
        .join(
            Apartment,
            Apartment.floor_id == Floor.id,
        )
        .where(
            Project.company_id == company_id,
            Apartment.is_public.is_(True),
        )
    ) or 0

    # =========================================================
    # Public apartment count
    # =========================================================

    apartment_count = db.scalar(
        select(
            func.count(Apartment.id)
        )
        .join(
            Floor,
            Apartment.floor_id == Floor.id,
        )
        .join(
            Building,
            Floor.building_id == Building.id,
        )
        .join(
            Project,
            Building.project_id == Project.id,
        )
        .where(
            Project.company_id == company_id,
            Apartment.is_public.is_(True),
        )
    ) or 0

    # =========================================================
    # Available public apartment count
    # Used for pagination
    # =========================================================

    available_apartment_count = db.scalar(
        select(
            func.count(Apartment.id)
        )
        .join(
            Floor,
            Apartment.floor_id == Floor.id,
        )
        .join(
            Building,
            Floor.building_id == Building.id,
        )
        .join(
            Project,
            Building.project_id == Project.id,
        )
        .where(
            Project.company_id == company_id,
            Apartment.is_public.is_(True),
            Apartment.status == ApartmentStatus.AVAILABLE,
        )
    ) or 0

    # =========================================================
    # First uploaded image
    # =========================================================

    first_image_subquery = (
        select(
            ApartmentImage.image_url
        )
        .where(
            ApartmentImage.apartment_id == Apartment.id
        )
        .order_by(
            ApartmentImage.created_at.asc()
        )
        .limit(1)
        .scalar_subquery()
    )

    # =========================================================
    # Available public apartments
    # 6 per page
    # =========================================================

    available_rows = db.execute(
        select(
            Apartment.id,
            Apartment.unit_number,
            Apartment.price,
            Apartment.area_sqm,
            Apartment.bedrooms,
            Apartment.bathrooms,

            Project.id.label(
                "project_id"
            ),
            Project.name.label(
                "project_name"
            ),

            first_image_subquery.label(
                "primary_image"
            ),
        )
        .join(
            Floor,
            Apartment.floor_id == Floor.id,
        )
        .join(
            Building,
            Floor.building_id == Building.id,
        )
        .join(
            Project,
            Building.project_id == Project.id,
        )
        .where(
            Project.company_id == company_id,
            Apartment.is_public.is_(True),
            Apartment.status == ApartmentStatus.AVAILABLE,
        )
        .order_by(
            Apartment.created_at.desc()
        )
        .offset(offset)
        .limit(page_size)
    ).all()

    available_apartments = [
        {
            "id": apartment_id,
            "unit_number": unit_number,

            "price": price,
            "area_sqm": area_sqm,
            "bedrooms": bedrooms,
            "bathrooms": bathrooms,

            "project_id": project_id,
            "project_name": project_name,

            "primary_image": primary_image,
        }
        for (
            apartment_id,
            unit_number,
            price,
            area_sqm,
            bedrooms,
            bathrooms,
            project_id,
            project_name,
            primary_image,
        ) in available_rows
    ]

    # =========================================================
    # Pagination metadata
    # =========================================================

    total_pages = (
        ceil(
            available_apartment_count / page_size
        )
        if available_apartment_count > 0
        else 0
    )

    # =========================================================
    # Final response
    # =========================================================

    return {
        "id": company.id,
        "name": company.name,

        "logo": company.logo,
        "address": company.address,
        "phone": company.phone,
        "email": company.email,

        "project_count": project_count,
        "building_count": building_count,
        "apartment_count": apartment_count,

        "available_apartments": {
            "items": available_apartments,
            "page": page,
            "page_size": page_size,
            "total": available_apartment_count,
            "total_pages": total_pages,
        },
    }
def get_public_apartments(
    db: Session,
    company_id: Optional[UUID] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 9,
):
    # Prevent invalid pagination values
    if page < 1:
        page = 1

    if page_size < 1:
        page_size = 9

    offset = (page - 1) * page_size

    # =========================================================
    # First uploaded image
    # =========================================================

    first_image_subquery = (
        select(
            ApartmentImage.image_url
        )
        .where(
            ApartmentImage.apartment_id == Apartment.id
        )
        .order_by(
            ApartmentImage.created_at.asc()
        )
        .limit(1)
        .scalar_subquery()
    )

    # =========================================================
    # Base conditions
    # =========================================================

    filters = [
        Apartment.is_public.is_(True),
        Company.is_active.is_(True),
    ]

    # =========================================================
    # Company filter
    # =========================================================

    if company_id is not None:
        filters.append(
            Company.id == company_id
        )

    # =========================================================
    # Search
    # =========================================================

    if search is not None:
        normalized_search = search.strip()

        if normalized_search:
            search_pattern = f"%{normalized_search}%"

            filters.append(
                or_(
                    Apartment.unit_number.ilike(
                        search_pattern
                    ),
                    Project.name.ilike(
                        search_pattern
                    ),
                    Project.location.ilike(
                        search_pattern
                    ),
                    Company.name.ilike(
                        search_pattern
                    ),
                )
            )

    # =========================================================
    # Total count
    # =========================================================

    total = db.scalar(
        select(
            func.count(Apartment.id)
        )
        .join(
            Floor,
            Apartment.floor_id == Floor.id,
        )
        .join(
            Building,
            Floor.building_id == Building.id,
        )
        .join(
            Project,
            Building.project_id == Project.id,
        )
        .join(
            Company,
            Project.company_id == Company.id,
        )
        .where(
            *filters
        )
    ) or 0

    # =========================================================
    # Apartments query
    # =========================================================

    query = (
        select(
            Apartment.id,
            Apartment.unit_number,

            Apartment.price,
            Apartment.area_sqm,
            Apartment.bedrooms,
            Apartment.bathrooms,
            Apartment.status,

            Floor.floor_number,

            Project.id.label("project_id"),
            Project.name.label("project_name"),

            Company.id.label("company_id"),
            Company.name.label("company_name"),

            first_image_subquery.label(
                "primary_image"
            ),
        )
        .join(
            Floor,
            Apartment.floor_id == Floor.id,
        )
        .join(
            Building,
            Floor.building_id == Building.id,
        )
        .join(
            Project,
            Building.project_id == Project.id,
        )
        .join(
            Company,
            Project.company_id == Company.id,
        )
        .where(
            *filters
        )
        .order_by(
            Apartment.created_at.desc()
        )
        .offset(offset)
        .limit(page_size)
    )

    rows = db.execute(query).all()

    # =========================================================
    # Response items
    # =========================================================

    items = [
        {
            "id": apartment_id,
            "unit_number": unit_number,

            "price": price,
            "area_sqm": area_sqm,
            "bedrooms": bedrooms,
            "bathrooms": bathrooms,

            "status": apartment_status,

            "floor_number": floor_number,

            "project_id": project_id,
            "project_name": project_name,

            "company_id": row_company_id,
            "company_name": company_name,

            "primary_image": primary_image,
        }
        for (
            apartment_id,
            unit_number,
            price,
            area_sqm,
            bedrooms,
            bathrooms,
            apartment_status,
            floor_number,
            project_id,
            project_name,
            row_company_id,
            company_name,
            primary_image,
        ) in rows
    ]

    total_pages = (
        ceil(total / page_size)
        if total > 0
        else 0
    )

    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
    }

def get_public_apartment_details(
    apartment_id: UUID,
    db: Session,
):
    row = db.execute(
        select(
            Apartment,

            Floor.id.label("floor_id"),
            Floor.floor_number,

            Building.id.label("building_id"),
            Building.name.label("building_name"),

            Project.id.label("project_id"),
            Project.name.label("project_name"),
            Project.location.label("project_location"),

            Company.id.label("company_id"),
            Company.name.label("company_name"),
            Company.logo.label("company_logo"),
        )
        .join(
            Floor,
            Apartment.floor_id == Floor.id,
        )
        .join(
            Building,
            Floor.building_id == Building.id,
        )
        .join(
            Project,
            Building.project_id == Project.id,
        )
        .join(
            Company,
            Project.company_id == Company.id,
        )
        .where(
            Apartment.id == apartment_id,
            Apartment.is_public.is_(True),
            Company.is_active.is_(True),
        )
    ).first()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Apartment not found",
        )

    (
        apartment,
        floor_id,
        floor_number,
        building_id,
        building_name,
        project_id,
        project_name,
        project_location,
        company_id,
        company_name,
        company_logo,
    ) = row

    images = db.scalars(
        select(ApartmentImage)
        .where(
            ApartmentImage.apartment_id == apartment_id
        )
        .order_by(
            ApartmentImage.created_at.asc()
        )
    ).all()

    return {
        "id": apartment.id,
        "unit_number": apartment.unit_number,
        "description": apartment.description,

        "price": apartment.price,
        "area_sqm": apartment.area_sqm,
        "bedrooms": apartment.bedrooms,
        "bathrooms": apartment.bathrooms,

        "status": apartment.status,

        "floor_id": floor_id,
        "floor_number": floor_number,

        "building_id": building_id,
        "building_name": building_name,

        "project_id": project_id,
        "project_name": project_name,
        "project_location": project_location,

        "company_id": company_id,
        "company_name": company_name,
        "company_logo": company_logo,

        "images": [
            {
                "id": image.id,
                "image_url": image.image_url,
            }
            for image in images
        ],
    }


def create_public_apartment_interest(
    apartment_id: UUID,
    payload: PublicApartmentInterestCreate,
    db: Session,
):
    # Verify apartment is public
    # and belongs to an active company
    apartment = db.scalar(
        select(Apartment)
        .join(
            Floor,
            Apartment.floor_id == Floor.id,
        )
        .join(
            Building,
            Floor.building_id == Building.id,
        )
        .join(
            Project,
            Building.project_id == Project.id,
        )
        .join(
            Company,
            Project.company_id == Company.id,
        )
        .where(
            Apartment.id == apartment_id,
            Apartment.is_public.is_(True),
            Company.is_active.is_(True),
        )
    )

    if apartment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Apartment not found",
        )

    lead = Lead(
        apartment_id=apartment_id,
        name=payload.name,
        phone=payload.phone,
        email=payload.email,
        message=payload.message,
        status=LeadStatus.NEW,
    )

    db.add(lead)
    db.commit()

    return lead