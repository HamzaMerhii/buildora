from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import Field

from app.models.apartment import ApartmentStatus
from app.schemas.base import BaseSchema


class ApartmentCreate(BaseSchema):
    unit_number: str = Field(
        ...,
        min_length=1,
        max_length=50,
    )

    area_sqm: Optional[Decimal] = Field(
        default=None,
        gt=0,
    )

    bedrooms: Optional[int] = Field(
        default=None,
        ge=0,
    )

    bathrooms: Optional[int] = Field(
        default=None,
        ge=0,
    )

    price: Optional[Decimal] = Field(
        default=None,
        ge=0,
    )

    status: ApartmentStatus = ApartmentStatus.AVAILABLE

    is_public: bool = False

    description: Optional[str] = None

class ApartmentUpdate(BaseSchema):
    unit_number: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=50,
    )

    area_sqm: Optional[Decimal] = Field(
        default=None,
        gt=0,
    )

    bedrooms: Optional[int] = Field(
        default=None,
        ge=0,
    )

    bathrooms: Optional[int] = Field(
        default=None,
        ge=0,
    )

    price: Optional[Decimal] = Field(
        default=None,
        ge=0,
    )

    status: Optional[ApartmentStatus] = None

    is_public: Optional[bool] = None

    description: Optional[str] = None


class ApartmentImageResponse(BaseSchema):
    id: UUID
    image_url: str


class ApartmentResponse(BaseSchema):
    id: UUID
    floor_id: UUID

    unit_number: str
    area_sqm: Optional[Decimal]
    bedrooms: Optional[int]
    bathrooms: Optional[int]
    price: Optional[Decimal]

    status: ApartmentStatus
    is_public: bool

    description: Optional[str]

    images: list[ApartmentImageResponse] = []

    created_at: datetime
    updated_at: datetime