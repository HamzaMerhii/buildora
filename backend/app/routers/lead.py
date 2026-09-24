from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.dependencies.permissions import require_sales
from app.models import User
from app.schemas.lead import LeadCreate, LeadResponse, LeadUpdate
from app.services.lead_service import (
    create_lead,
    get_company_leads,
    get_lead_details,
    update_lead_details)


router = APIRouter(
    prefix=(
        "/companies/{company_id}"
        "/projects/{project_id}"
        "/buildings/{building_id}"
        "/floors/{floor_id}"
        "/apartments/{apartment_id}"
        "/leads"
    ),
    tags=["Leads"],
)


@router.post(
    "/",
    response_model=LeadResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_lead(
    company_id: UUID,
    project_id: UUID,
    building_id: UUID,
    floor_id: UUID,
    apartment_id: UUID,
    lead: LeadCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales),
):
    return create_lead(
        company_id=company_id,
        project_id=project_id,
        building_id=building_id,
        floor_id=floor_id,
        apartment_id=apartment_id,
        lead=lead,
        db=db,
    )

@router.get(
    "/",
    response_model=list[LeadResponse],
)
def list_project_leads(
    company_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales),
):
    return get_company_leads(
        company_id=company_id,
        db=db,
    )

@router.get(
    "/{lead_id}",
    response_model=LeadResponse,
)
def get_lead(
    company_id: UUID,
    lead_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales),
):
    return get_lead_details(
        company_id=company_id,
        lead_id=lead_id,
        db=db,
    )


@router.patch(
    "/{lead_id}",
    response_model=LeadResponse,
)
def update_lead(
    company_id: UUID,
    lead_id: UUID,
    lead_update: LeadUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales),
):
    return update_lead_details(
        company_id=company_id,
        lead_id=lead_id,
        lead_update=lead_update,
        db=db,
    )