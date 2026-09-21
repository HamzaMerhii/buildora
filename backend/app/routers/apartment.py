from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.dependencies.permissions import require_project_manager
from app.models import User
from app.models.apartment import ApartmentStatus
from app.schemas.apartment import (
    ApartmentCreate,
    ApartmentResponse,
    ApartmentUpdate,
)
from app.services.apartment_service import (
    create_apartment, 
    get_apartment_details, 
    get_floor_apartments, 
    update_apartment, 
    add_images_to_apartment,
    remove_apartment_image)
from app.services.imagekit_service import upload_apartment_image


router = APIRouter(
    prefix=(
        "/companies/{company_id}"
        "/projects/{project_id}"
        "/buildings/{building_id}"
        "/floors/{floor_id}"
        "/apartments"
    ),
    tags=["Apartments"],
)


@router.post(
    "/",
    response_model=ApartmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_new_apartment(
    company_id: UUID,
    project_id: UUID,
    building_id: UUID,
    floor_id: UUID,
    unit_number: str = Form(...),
    area_sqm: Optional[Decimal] = Form(None),
    bedrooms: Optional[int] = Form(None),
    bathrooms: Optional[int] = Form(None),
    price: Optional[Decimal] = Form(None),
    status: ApartmentStatus = Form(ApartmentStatus.AVAILABLE),
    is_public: bool = Form(False),
    description: Optional[str] = Form(None),
    images: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_project_manager),
):
    def _clean_optional(value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    try:
        apartment_data = ApartmentCreate(
            unit_number=unit_number.strip(),
            area_sqm=area_sqm,
            bedrooms=bedrooms,
            bathrooms=bathrooms,
            price=price,
            status=status,
            is_public=is_public,
            description=_clean_optional(description),
        )
    except ValidationError as exc:
        raise RequestValidationError(exc.errors())

    image_urls: list[str] = []
    for image in images or []:
        image_urls.append(await upload_apartment_image(image))

    return create_apartment(
        company_id=company_id,
        project_id=project_id,
        building_id=building_id,
        floor_id=floor_id,
        apartment=apartment_data,
        db=db,
        image_urls=image_urls,
    )


@router.patch(
    "/{apartment_id}",
    response_model=ApartmentResponse,
    status_code=status.HTTP_200_OK,
)
def update_existing_apartment(
    company_id: UUID,
    project_id: UUID,
    building_id: UUID,
    floor_id: UUID,
    apartment_id: UUID,
    apartment: ApartmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_project_manager),
):
    return update_apartment(
        company_id=company_id,
        project_id=project_id,
        building_id=building_id,
        floor_id=floor_id,
        apartment_id=apartment_id,
        apartment=apartment,
        db=db,
    )

@router.get(
    "/",
    response_model=list[ApartmentResponse],
)
def list_apartments(
    company_id: UUID,
    project_id: UUID,
    building_id: UUID,
    floor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_project_manager),
):
    return get_floor_apartments(
        company_id=company_id,
        project_id=project_id,
        building_id=building_id,
        floor_id=floor_id,
        db=db,
    )
@router.get(
    "/{apartment_id}",
    response_model=ApartmentResponse,
    status_code=status.HTTP_200_OK,
)
def get_apartment(
    company_id: UUID,
    project_id: UUID,
    building_id: UUID,
    floor_id: UUID,
    apartment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_project_manager),
):
    return get_apartment_details(
        company_id=company_id,
        project_id=project_id,
        building_id=building_id,
        floor_id=floor_id,
        apartment_id=apartment_id,
        db=db,
    )


@router.post(
    "/{apartment_id}/images",
    response_model=ApartmentResponse,
    status_code=status.HTTP_200_OK,
)
async def add_apartment_images(
    company_id: UUID,
    project_id: UUID,
    building_id: UUID,
    floor_id: UUID,
    apartment_id: UUID,
    images: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_project_manager),
):
    image_urls: list[str] = []

    for image in images:
        image_urls.append(
            await upload_apartment_image(image)
        )

    return add_images_to_apartment(
        company_id=company_id,
        project_id=project_id,
        building_id=building_id,
        floor_id=floor_id,
        apartment_id=apartment_id,
        image_urls=image_urls,
        db=db,
    )

@router.delete(
    "/{apartment_id}/images/{image_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_apartment_image(
    company_id: UUID,
    project_id: UUID,
    building_id: UUID,
    floor_id: UUID,
    apartment_id: UUID,
    image_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_project_manager),
):
    remove_apartment_image(
        company_id=company_id,
        project_id=project_id,
        building_id=building_id,
        floor_id=floor_id,
        apartment_id=apartment_id,
        image_id=image_id,
        db=db,
    )