from fastapi import HTTPException, status
from sqlalchemy.orm import Session,selectinload
from app.models import Company,CompanyMembership,CompanyRole,PlatformRole
from app.models.user import User
from app.schemas import CompanyCreate, CompanyUpdate, CompanyMemberCreate,CompanyMemberUpdate
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from uuid import UUID

from app.core.security import (
    hash_password
)
def create_company(
    company: CompanyCreate,
    owner_user: User,
    db: Session
):

    conditions = []

    if company.email:
        conditions.append(
            Company.email == company.email.lower().strip()
        )

    if company.phone:
        conditions.append(
            Company.phone == company.phone
        )

    if conditions:
        existing_company = db.scalar(
            select(Company).where(
                or_(*conditions)
            )
        )
        if existing_company:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email or Phone already registered"
            )

    new_company = Company(
        name=company.name,
        email=company.email,
        phone=company.phone,
        address=company.address,
        logo=company.logo,
        is_active=True
    )

    try:
        db.add(new_company)
        db.commit()
        db.refresh(new_company)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email or phone already registered"
        )

    membership = CompanyMembership(
        user_id=owner_user.id,
        company_id=new_company.id,
        role=CompanyRole.OWNER,
        is_active=True,
    )

    db.add(membership)

    db.commit()
    db.refresh(new_company)
    return {
        "message": "Company created successfully",
    }


def get_company_members(
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

    members = db.scalars(
    select(CompanyMembership)
    .options(
        selectinload(CompanyMembership.user)
    )
    .where(
        CompanyMembership.company_id == company_id,
    )
    .order_by(
        CompanyMembership.created_at.asc()
    )
).all()

    return members


def get_user_companies(
    user_id: UUID,
    db: Session,
):
    companies = db.scalars(
        select(Company)
        .join(
            CompanyMembership,
            CompanyMembership.company_id == Company.id,
        )
        .where(
            CompanyMembership.user_id == user_id,
            CompanyMembership.is_active.is_(True),

        )
        .order_by(
            Company.created_at.desc()
        )
    ).all()

    return companies


def get_deactivated_user_companies(
    user_id: UUID,
    db: Session,
):
    companies = db.scalars(
        select(Company)
        .join(
            CompanyMembership,
            CompanyMembership.company_id == Company.id,
        )
        .where(
            CompanyMembership.user_id == user_id,
            CompanyMembership.is_active.is_(False),

        )
        .order_by(
            Company.created_at.desc()
        )
    ).all()

    return companies


def update_company_details(
    company_id: UUID,
    company_update: CompanyUpdate,
    logo_url: str | None,
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
        exclude_unset=True,
        exclude_none=True,
    )

    for field, value in update_data.items():
        setattr(company, field, value)

    if logo_url is not None:
        company.logo = logo_url

    db.commit()
    db.refresh(company)

    return company

def get_company_details(
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

def create_company_member(
    company_id: UUID,
    member: CompanyMemberCreate,
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

    existing_email = db.scalar(
        select(User).where(
            User.email == member.email,
            User.deleted_at.is_(None),
        )
    )

    if existing_email is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already exists",
        )

    existing_phone = db.scalar(
        select(User).where(
            User.phone == member.phone,
            User.deleted_at.is_(None),
        )
    )

    if existing_phone is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Phone already exists",
        )

    user = User(
        name=member.name.strip(),
        email=member.email,
        phone=member.phone,
        password_hash=hash_password(member.password),
        platform_role=PlatformRole.USER,
        is_active=True,
    )

    db.add(user)
    db.flush()

    membership = CompanyMembership(
        company_id=company_id,
        user_id=user.id,
        role=member.role,
        is_active=True,
    )

    try:
        db.add(membership)
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(membership)

    return membership



def update_company_membership(
    company_id: UUID,
    membership_id: UUID,
    member_update: CompanyMemberUpdate,
    current_user: User,
    db: Session,
):
    membership = db.scalar(
        select(CompanyMembership).where(
            CompanyMembership.id == membership_id,
            CompanyMembership.company_id == company_id,
        )
    )

    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company membership not found",
        )

    update_data = member_update.model_dump(
        exclude_unset=True
    )

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided for update",
        )

    # Prevent owner from deactivating their own membership
    if (
        membership.user_id == current_user.id
        and update_data.get("is_active") is False
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own company membership",
        )

    # Prevent owner from removing their own OWNER role
    if (
        membership.user_id == current_user.id
        and "role" in update_data
        and update_data["role"] != CompanyRole.OWNER
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot remove your own owner role",
        )

    for field, value in update_data.items():
        setattr(
            membership,
            field,
            value,
        )

    db.commit()
    db.refresh(membership)

    return membership