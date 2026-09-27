from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query,status
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.schemas.public import PublicApartmentDetailsResponse, PublicApartmentInterestCreate, PublicApartmentInterestResponse, PublicApartmentPaginatedResponse, PublicApartmentResponse, PublicCompanyDetailsResponse, PublicCompanySummary
from app.services.public_service import (
    get_public_companies,
    get_public_company_details,
    get_public_apartments,
    get_public_apartment_details,
    create_public_apartment_interest,)


router = APIRouter(
    prefix="/public",
    tags=["Public"],
)


@router.get(
    "/companies",
    response_model=list[PublicCompanySummary],
)
def list_public_companies(
    db: Session = Depends(get_db),
):
    return get_public_companies(
        db=db,
    )

@router.get(
    "/companies/{company_id}",
    response_model=PublicCompanyDetailsResponse,
)
def get_public_company(
    company_id: UUID,

    page: int = Query(
        1,
        ge=1,
    ),

    page_size: int = Query(
        6,
        ge=1,
        le=100,
    ),

    db: Session = Depends(get_db),
):
    return get_public_company_details(
        company_id=company_id,
        page=page,
        page_size=page_size,
        db=db,
    )
@router.get(
    "/apartments",
    response_model=PublicApartmentPaginatedResponse,
)
def list_public_apartments(
    company_id: Optional[UUID] = Query(None),

    page: int = Query(
        1,
        ge=1,
    ),

    page_size: int = Query(
        9,
        ge=1,
        le=100,
    ),

    db: Session = Depends(get_db),
):
    return get_public_apartments(
        company_id=company_id,
        page=page,
        page_size=page_size,
        db=db,
    )

@router.get(
    "/apartments/{apartment_id}",
    response_model=PublicApartmentDetailsResponse,
)
def get_public_apartment(
    apartment_id: UUID,
    db: Session = Depends(get_db),
):
    return get_public_apartment_details(
        apartment_id=apartment_id,
        db=db,
    )

@router.post(
    "/apartments/{apartment_id}/interest",
    response_model=PublicApartmentInterestResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_apartment_interest(
    apartment_id: UUID,
    payload: PublicApartmentInterestCreate,
    db: Session = Depends(get_db),
):
    create_public_apartment_interest(
        apartment_id=apartment_id,
        payload=payload,
        db=db,
    )

    return {
        "message": "Interest submitted successfully"
    }