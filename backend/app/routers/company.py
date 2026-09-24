from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from app.database.db import get_db
from app.models import Company
from app.dependencies import require_company_owner, require_normal_user, require_super_admin
from app.models.user import User
from uuid import UUID

from app.schemas import CompanyCreate,CompanyMemberResponse, CompanyUpdate, CompanyResponse,CompanyMemberCreate,CompanyMemberUpdate
from app.services.company_service import (
    create_company,
    get_user_companies,
    get_deactivated_user_companies,
    update_company_details,
    get_company_members,
    get_company_details,
    create_company_member,
    update_company_membership
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

@router.get(
    "/",
    response_model=list[CompanyResponse],
)
def list_my_companies(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return get_user_companies(
        user_id=current_user.id,
        db=db,
    )

@router.get(
    "/deactivated-user",
    response_model=list[CompanyResponse],
)
def list_my_companies(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return get_deactivated_user_companies(
        user_id=current_user.id,
        db=db,
    )


@router.get(
    "/{company_id}",
    response_model=CompanyResponse,
)
def get_company(
    company_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_company_owner),
):
    return get_company_details(
        company_id=company_id,
        db=db,
    )

@router.patch(
    "/{company_id}",
    response_model=CompanyResponse,
)
async def update_company(
    company_id: UUID,

    name: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
    description: Optional[str] = Form(None),

    logo: Optional[UploadFile] = File(None),

    db: Session = Depends(get_db),
    current_user: User = Depends(require_company_owner),
):
    try:
        company_update = CompanyUpdate(
            name=name,
            email=email,
            phone=phone,
            address=address,
            description=description,
        )
    except ValidationError as exc:
        raise RequestValidationError(exc.errors())

    logo_url = None

    if logo is not None:
        logo_url = await upload_company_logo(logo)

    return update_company_details(
        company_id=company_id,
        company_update=company_update,
        logo_url=logo_url,
        db=db,
    )

@router.get(
    "/{company_id}/members/",
    response_model=list[CompanyMemberResponse],
)
def list_company_members(
    company_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_company_owner),
):
    return get_company_members(
        company_id=company_id,
        db=db,
    )

@router.post(
    "/{company_id}/members",
    response_model=CompanyMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_company_member(
    company_id: UUID,
    member: CompanyMemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_company_owner),
):
    return create_company_member(
        company_id=company_id,
        member=member,
        db=db,
    )
@router.patch(
    "/{company_id}/members/{membership_id}",
    response_model=CompanyMemberResponse,
)
def update_company_member(
    company_id: UUID,
    membership_id: UUID,
    member_update: CompanyMemberUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_company_owner),
):
    return update_company_membership(
        company_id=company_id,
        membership_id=membership_id,
        member_update=member_update,
        current_user=current_user,
        db=db,
    )