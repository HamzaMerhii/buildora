from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from app.database.db import get_db
from app.dependencies.auth import get_current_user
from app.models import Company
from typing import Annotated
from app.dependencies import require_company_owner, require_project_manager, require_normal_user
from app.models.user import User
from app.schemas import CompanyCreate, CompanyUpdate, CompanyResponse
from app.services.company_service import (
    create_company,
    # update_company,
    # get_paginated_companies,
    # update_company_admin,
    # delete_company_admin
)
from app.services.imagekit_service import upload_company_logo
from sqlalchemy.orm import Session

#Defines authentication endpoints:
router = APIRouter(
    prefix="/companies",
    tags=["Companies"]
)
@router.post(
    "/",
    status_code=status.HTTP_201_CREATED
)
async def create_new_company(
    name: str = Form(...),
    email: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
    logo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_normal_user),
):
    def _clean_optional(value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    try:
        company_data = CompanyCreate(
            name=name.strip(),
            email=_clean_optional(email),
            phone=_clean_optional(phone),
            address=_clean_optional(address),
        )
    except ValidationError as exc:
        raise RequestValidationError(exc.errors())

    logo_url: Optional[str] = None
    if logo is not None:
        logo_url = await upload_company_logo(logo)

    company_data.logo = logo_url

    return create_company(
        owner_user=current_user,
        company=company_data,
        db=db
    )
