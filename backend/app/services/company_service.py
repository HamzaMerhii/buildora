from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models import Company,CompanyMembership,CompanyRole
from app.models.user import User
from app.schemas import CompanyCreate, CompanyUpdate, CompanyResponse
from sqlalchemy import or_, select
from app.dependencies import get_current_user
from sqlalchemy.exc import IntegrityError

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