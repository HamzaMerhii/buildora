from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.dependencies.permissions import require_project_manager
from app.models import User
from app.schemas.party import PartyCreate, PartyResponse, PartyUpdate
from app.services.party_service import (
    create_party,
    get_company_parties,
    get_party_details,
    update_party)


router = APIRouter(
    prefix="/companies/{company_id}/parties",
    tags=["Parties"],
)


@router.post(
    "/",
    response_model=PartyResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_party(
    company_id: UUID,
    party: PartyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_project_manager),
):
    return create_party(
        company_id=company_id,
        party=party,
        db=db,
    )

@router.get(
    "/",
    response_model=list[PartyResponse],
)
def list_parties(
    company_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_project_manager),
):
    return get_company_parties(
        company_id=company_id,
        db=db,
    )

@router.get(
    "/{party_id}",
    response_model=PartyResponse,
)
def get_party(
    company_id: UUID,
    party_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_project_manager),
):
    return get_party_details(
        company_id=company_id,
        party_id=party_id,
        db=db,
    )


@router.patch(
    "/{party_id}",
    response_model=PartyResponse,
)
def patch_party(
    company_id: UUID,
    party_id: UUID,
    party: PartyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_project_manager),
):
    return update_party(
        company_id=company_id,
        party_id=party_id,
        party=party,
        db=db,
    )