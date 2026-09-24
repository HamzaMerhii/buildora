from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from app.core.security import (create_access_token, hash_password)
from app.models import User, PlatformRole
from uuid import UUID
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from app.schemas import UserCreateSchema, UserUpdateSchema, UserFilterParams, UserPaginatedResponse, UserUpdateByAdminSchema
from app.dependencies import get_current_user

def create_user(
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

    new_user = User(
        name=user.name,
        email=user.email,
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
    access_token = create_access_token(
        str(new_user.id),
        new_user.platform_role.value,
    )
    return {
        "message": "User created successfully",
        "access_token": access_token,
        "token_type": "bearer",
    }



def update_current_user(
    current_user: User,
    user_update: UserUpdateSchema,
    db: Session,
):
    update_data = user_update.model_dump(
        exclude_unset=True
    )

    if "email" in update_data:
        existing_user = db.scalar(
            select(User).where(
                User.email == update_data["email"],
                User.id != current_user.id,
                User.deleted_at.is_(None),
            )
        )

        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already in use",
            )

    if "phone" in update_data:
        existing_user = db.scalar(
            select(User).where(
                User.phone == update_data["phone"],
                User.id != current_user.id,
                User.deleted_at.is_(None),
            )
        )

        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Phone number already in use",
            )

    for field, value in update_data.items():
        setattr(
            current_user,
            field,
            value,
        )

    db.commit()
    db.refresh(current_user)

    return current_user