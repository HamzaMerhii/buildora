from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile, status,Query
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.dependencies.permissions import require_project_manager,require_site_management
from app.models import User
from app.models.party import PartyType
from app.schemas.party import PartyCreate, PartyResponse
from app.services.party_service import (
    create_party)


router = APIRouter(
    prefix="/companies/{company_id}/parties/",
    tags=["parties"],
)


@router.post(
    "/",
    response_model=PartyResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_party(
    party: PartyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_project_manager),
):
    return create_party(
        party=party,
        db=db,
    )