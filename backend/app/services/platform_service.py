from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.company import Company
from app.schemas.platform import PlatformCompanyUpdate, PlatformUserUpdate
from app.models.user import User


def get_platform_companies(
    db: Session,
):
    companies = db.scalars(
        select(Company)
        .order_by(
            Company.created_at.desc()
        )
    ).all()

    return companies

def get_platform_company_details(
    company_id: UUID,
    db: Session,
):
    company = db.scalar(
        select(Company).where(
            Company.id == company_id
        )
    )

    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )

    return company

def update_platform_company_details(
    company_id: UUID,
    company_update: PlatformCompanyUpdate,
    db: Session,
):
    company = db.scalar(
        select(Company).where(
            Company.id == company_id
        )
    )

    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )

    update_data = company_update.model_dump(
        exclude_unset=True
    )

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided for update",
        )

    for field, value in update_data.items():
        setattr(
            company,
            field,
            value,
        )

    db.commit()
    db.refresh(company)

    return company

def get_platform_users(
    db: Session,
):
    users = db.scalars(
        select(User)
        .where(
            User.deleted_at.is_(None)
        )
        .order_by(
            User.created_at.desc()
        )
    ).all()

    return users

def update_platform_user(
    user_id: UUID,
    user_update: PlatformUserUpdate,
    current_user: User,
    db: Session,
):
    user = db.scalar(
        select(User).where(
            User.id == user_id,
            User.deleted_at.is_(None),
        )
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    update_data = user_update.model_dump(
        exclude_unset=True
    )

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided for update",
        )

    # Prevent the super admin from disabling their own account
    if (
        user.id == current_user.id
        and update_data.get("is_active") is False
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account",
        )

    for field, value in update_data.items():
        setattr(
            user,
            field,
            value,
        )

    db.commit()
    db.refresh(user)

    return user