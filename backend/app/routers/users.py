from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.database.db import get_db
from app.models import User
from typing import Annotated
from app.dependencies import require_authenticated_user
from app.schemas import UserCreateSchema,UserOutSchema,UserUpdateSchema, UserFilterParams, UserUpdateByAdminSchema
from app.services.user_service import (
    create_user,
    update_current_user,
    # update_user,
    # get_paginated_users,
    # update_admin,
    # delete_admin
)

#Defines authentication endpoints:
router = APIRouter(
    prefix="/users",
    tags=["Users"]
)

@router.post(
    "/",
    status_code=status.HTTP_201_CREATED
)
def create_new_user(
    user: UserCreateSchema,
    db: Session = Depends(get_db)
):
    return create_user(
        user,
        db
    )

@router.patch(
    "/me",
    response_model=UserOutSchema,
)
def update_my_profile(
    user_update: UserUpdateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated_user),
):
    return update_current_user(
        current_user=current_user,
        user_update=user_update,
        db=db,
    )