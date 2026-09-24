from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from uuid import UUID

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_password_reset_token,
    hash_password,
    verify_password,
    verify_password_reset_token,
)
from fastapi import HTTPException, status

from app.services.email_service import (
    send_password_reset_email,
)
from app.models import Company, CompanyMembership, User, PlatformRole, user
from app.schemas import UserCreateSchema
from app.schemas.auth import ChangePasswordSchema, UserLoginSchema

FORGOT_PASSWORD_MESSAGE = (
    "If an account with that email exists, "
    "a password reset link has been sent."
)

def register_user(
    user: UserCreateSchema,
    db: Session
):
    conditions = [
        User.email == user.email.lower().strip()
        ]
    
    if user.phone:
        conditions.append(
            User.phone == user.phone
        )
    
    existing_user = db.scalar(
        select(User).where(
            or_(*conditions)
        )
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email or Phone already registered"
        )

    # Create SQLAlchemy User object
    new_user = User(
        name=user.name,
        email=user.email.lower().strip(),
        phone=user.phone,
        password_hash=hash_password(user.password),
        platform_role=PlatformRole.USER,
        is_active=True
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email or phone already registered"
        )

    return {
        "message": "User created successfully",
        "id": str(new_user.id),
    }


def login_user(
    email: str,
    password: str,
    db: Session,
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password",
        headers={
            "WWW-Authenticate": "Bearer"
        },
    )

    normalized_email = email.lower().strip()

    user = db.scalar(
        select(User).where(
            User.email == normalized_email,
            User.deleted_at.is_(None),
        )
    )

    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    if not verify_password(
        password,
        user.password_hash,
    ):
        raise credentials_exception

    # SUPER_ADMIN is platform-level and does not depend on a company
    if user.platform_role != PlatformRole.SUPER_ADMIN:
        active_company = db.scalar(
            select(Company)
            .join(
                CompanyMembership,
                CompanyMembership.company_id == Company.id,
            )
            .where(
                CompanyMembership.user_id == user.id,
                CompanyMembership.is_active.is_(True),
                Company.is_active.is_(True),
            )
            .limit(1)
        )

        if active_company is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not belong to an active company",
            )

    access_token = create_access_token(
        str(user.id),
        user.platform_role.value,
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }

def get_session_context(
    current_user: User,
    db: Session,
):
    rows = db.execute(
        select(CompanyMembership, Company.name)
        .join(
            Company,
            Company.id == CompanyMembership.company_id,
        )
        .where(
            CompanyMembership.user_id == current_user.id,
            CompanyMembership.is_active.is_(True),
        )
        .order_by(CompanyMembership.created_at.asc())
    ).all()

    memberships = [
        {
            "company_id": membership.company_id,
            "company_name": company_name,
            "role": membership.role,
        }
        for membership, company_name in rows
    ]

    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "platform_role": current_user.platform_role,
        "memberships": memberships,
    }
async def forgot_password(
    email: str,
    db: Session,
):
    normalized_email = email.lower().strip()

    user = db.scalar(
        select(User).where(
            User.email == normalized_email,
            User.deleted_at.is_(None),
        )
    )

    # Never reveal if an email exists or not
    if user is None:
        return {
            "message": FORGOT_PASSWORD_MESSAGE
        }

    if not user.is_active:
        return {
            "message": FORGOT_PASSWORD_MESSAGE
        }

    reset_token = create_password_reset_token(
        str(user.id)
    )

    reset_link = (
        f"{settings.FRONTEND_URL}"
        f"/reset-password"
        f"?token={reset_token}"
    )

    try:
        await send_password_reset_email(
            to_email=user.email,
            user_name=user.name,
            reset_link=reset_link,
        )

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to send password reset email",
        )

    return {
        "message": FORGOT_PASSWORD_MESSAGE
    }

def reset_password(
    token: str,
    new_password: str,
    db: Session,
):
    user_id = verify_password_reset_token(token)

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token",
        )

    try:
        parsed_user_id = UUID(user_id)

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid password reset token",
        )

    user = db.scalar(
        select(User).where(
            User.id == parsed_user_id,
            User.deleted_at.is_(None),
        )
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    user.password_hash = hash_password(
        new_password
    )

    db.commit()

    return {
        "message": "Password reset successfully"
    }

def change_password(
    current_user: User,
    payload: ChangePasswordSchema,
    db: Session,
):
    if not verify_password(
        payload.current_password,
        current_user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    if verify_password(
        payload.new_password,
        current_user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password",
        )

    current_user.password = hash_password(
        payload.new_password
    )

    db.commit()
    db.refresh(current_user)