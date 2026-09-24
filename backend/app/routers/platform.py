from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.dependencies.permissions import require_super_admin
from app.models.user import User
from app.schemas.company import CompanyResponse
from app.services.platform_service import (
    get_platform_companies,
    get_platform_company_details,
    get_platform_users,
    update_platform_company_details,
    update_platform_user
)
from app.schemas.platform import PlatformCompanyDetailsResponse, PlatformCompanyUpdate, PlatformUserResponse, PlatformUserUpdate


router = APIRouter(
    prefix="/platform",
    tags=["Platform"],
)


@router.get(
    "/companies",
    response_model=list[CompanyResponse],
)
def list_platform_companies(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return get_platform_companies(
        db=db,
    )

@router.get(
    "/companies/{company_id}",
    response_model=PlatformCompanyDetailsResponse,
)
def get_platform_company(
    company_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return get_platform_company_details(
        company_id=company_id,
        db=db,
    )

@router.patch(
    "/companies/{company_id}",
    response_model=PlatformCompanyDetailsResponse,
)
def update_platform_company(
    company_id: UUID,
    company_update: PlatformCompanyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return update_platform_company_details(
        company_id=company_id,
        company_update=company_update,
        db=db,
    )


@router.get(
    "/users",
    response_model=list[PlatformUserResponse],
)
def list_platform_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return get_platform_users(
        db=db,
    )

@router.patch(
    "/users/{user_id}",
    response_model=PlatformUserResponse,
)
def patch_platform_user(
    user_id: UUID,
    user_update: PlatformUserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return update_platform_user(
        user_id=user_id,
        user_update=user_update,
        current_user=current_user,
        db=db,
    )