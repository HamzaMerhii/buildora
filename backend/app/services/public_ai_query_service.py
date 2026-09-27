from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.apartment import Apartment
from app.models.apartment_image import ApartmentImage
from app.models.building import Building
from app.models.company import Company
from app.models.floor import Floor
from app.models.project import Project

from app.schemas.public_ai import (
    PublicApartmentSearchFilters,
    PublicApartmentResult,
)


def search_public_apartments(
    *,
    db: Session,
    filters: PublicApartmentSearchFilters,
    limit: int = 9,
) -> list[PublicApartmentResult]:

    # Never allow more than 9 results
    limit = min(limit, 9)

    primary_image_subquery = (
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

    stmt = (
        select(
            Apartment,
            Project,
            Company,
            primary_image_subquery.label(
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
            Apartment.is_public.is_(True),
            Apartment.status == "available",
            Company.is_active.is_(True),
        )
    )

    # -----------------------------------
    # LOCATION
    # -----------------------------------

    if filters.location:
        stmt = stmt.where(
            Project.location.ilike(
                f"%{filters.location.strip()}%"
            )
        )

    # -----------------------------------
    # COMPANY
    # -----------------------------------

    if filters.company_name:
        stmt = stmt.where(
            Company.name.ilike(
                f"%{filters.company_name.strip()}%"
            )
        )

    # -----------------------------------
    # PROJECT
    # -----------------------------------

    if filters.project_name:
        stmt = stmt.where(
            Project.name.ilike(
                f"%{filters.project_name.strip()}%"
            )
        )

    # -----------------------------------
    # BEDROOMS
    # -----------------------------------

    if filters.bedrooms is not None:
        stmt = stmt.where(
            Apartment.bedrooms
            == filters.bedrooms
        )

    # -----------------------------------
    # BATHROOMS
    # -----------------------------------

    if filters.bathrooms is not None:
        stmt = stmt.where(
            Apartment.bathrooms
            == filters.bathrooms
        )

    # -----------------------------------
    # MIN PRICE
    # -----------------------------------

    if filters.min_price is not None:
        stmt = stmt.where(
            Apartment.price
            >= filters.min_price
        )

    # -----------------------------------
    # MAX PRICE
    # -----------------------------------

    if filters.max_price is not None:
        stmt = stmt.where(
            Apartment.price
            <= filters.max_price
        )

    # -----------------------------------
    # MIN AREA
    # -----------------------------------

    if filters.min_area is not None:
        stmt = stmt.where(
            Apartment.area_sqm
            >= filters.min_area
        )

    # -----------------------------------
    # MAX AREA
    # -----------------------------------

    if filters.max_area is not None:
        stmt = stmt.where(
            Apartment.area_sqm
            <= filters.max_area
        )

    # -----------------------------------
    # ORDER / LIMIT
    # -----------------------------------

    stmt = (
        stmt
        .order_by(
            Apartment.price.asc().nulls_last()
        )
        .limit(limit)
    )

    rows = db.execute(
        stmt
    ).all()

    # -----------------------------------
    # SERIALIZE
    # -----------------------------------

    results: list[
        PublicApartmentResult
    ] = []

    for (
        apartment,
        project,
        company,
        primary_image,
    ) in rows:

        results.append(
            PublicApartmentResult(
                id=str(
                    apartment.id
                ),

                unit_number=(
                    apartment.unit_number
                ),

                price=(
                    float(apartment.price)
                    if apartment.price is not None
                    else None
                ),

                area_sqm=(
                    float(apartment.area_sqm)
                    if apartment.area_sqm is not None
                    else None
                ),

                bedrooms=(
                    apartment.bedrooms
                ),

                bathrooms=(
                    apartment.bathrooms
                ),

                status=(
                    apartment.status
                ),

                image=(
                    primary_image
                ),

                project_id=str(
                    project.id
                ),

                project_name=(
                    project.name
                ),

                company_id=str(
                    company.id
                ),

                company_name=(
                    company.name
                ),

                location=(
                    project.location
                ),
            )
        )

    return results