from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


# =========================================================
# Public company list
# GET /public/companies
# =========================================================

class PublicCompanySummary(BaseModel):
    id: UUID
    name: str

    logo: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

    apartment_count: int


# =========================================================
# Public apartment list
# GET /public/apartments
# =========================================================

class PublicApartmentResponse(BaseModel):
    id: UUID
    unit_number: str

    price: Optional[Decimal] = None
    area_sqm: Optional[Decimal] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None

    status: str

    floor_number: int

    project_id: UUID
    project_name: str

    company_id: UUID
    company_name: str

    primary_image: Optional[str] = None


# =========================================================
# Public apartment images
# =========================================================

class PublicApartmentImageResponse(BaseModel):
    id: UUID
    image_url: str


# =========================================================
# Public apartment details
# GET /public/apartments/{apartment_id}
# =========================================================

class PublicApartmentDetailsResponse(BaseModel):
    id: UUID
    unit_number: str

    description: Optional[str] = None

    price: Optional[Decimal] = None
    area_sqm: Optional[Decimal] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None

    status: str

    floor_id: UUID
    floor_number: int

    building_id: UUID
    building_name: Optional[str] = None

    project_id: UUID
    project_name: str
    project_location: Optional[str] = None

    company_id: UUID
    company_name: str
    company_logo: Optional[str] = None

    images: list[PublicApartmentImageResponse]


# =========================================================
# Public apartment interest
# POST /public/apartments/{apartment_id}/interest
# =========================================================

class PublicApartmentInterestCreate(BaseModel):
    name: str = Field(
        ...,
        min_length=1,
        max_length=200,
    )

    phone: str = Field(
        ...,
        min_length=5,
        max_length=30,
    )

    email: Optional[EmailStr] = None

    message: Optional[str] = Field(
        default=None,
        max_length=1000,
    )


class PublicApartmentInterestResponse(BaseModel):
    message: str


# =========================================================
# Apartments shown inside public company details
# =========================================================

class PublicCompanyApartmentResponse(BaseModel):
    id: UUID
    unit_number: str

    price: Optional[Decimal] = None
    area_sqm: Optional[Decimal] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None

    project_id: UUID
    project_name: str

    primary_image: Optional[str] = None


# =========================================================
# Public company details
# GET /public/companies/{company_id}
# =========================================================
class PublicCompanyApartmentPaginatedResponse(BaseModel):
    items: list[PublicCompanyApartmentResponse]

    page: int
    page_size: int
    total: int
    total_pages: int

class PublicCompanyDetailsResponse(BaseModel):
    id: UUID
    name: str

    logo: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

    project_count: int
    building_count: int
    apartment_count: int

    available_apartments: (
        PublicCompanyApartmentPaginatedResponse
    )

class PublicApartmentPaginatedResponse(BaseModel):
    items: list[PublicApartmentResponse]

    page: int
    page_size: int

    total: int
    total_pages: int