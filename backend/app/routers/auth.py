from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas import Token
from app.schemas.auth import ChangePasswordSchema, ForgotPasswordSchema, ResetPasswordSchema, SessionContextResponse, UserRegisterSchema
from app.services.auth_service import (
    get_session_context,
    login_user,
    register_user,
    forgot_password,
    reset_password,
    change_password
)


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED
)
def register(
    user: UserRegisterSchema,
    db: Session = Depends(get_db)
):
    return register_user(
        user,
        db
    )


@router.post(
    "/login",
    response_model=Token
)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    return login_user(
        email=form_data.username,
        password=form_data.password,
        db=db
    )

@router.get(
    "/me",
    response_model=SessionContextResponse
)
def get_current_session(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return get_session_context(
        current_user,
        db
    )

@router.post("/forgot-password")
async def forgot_password_route(
    data: ForgotPasswordSchema,
    db: Session = Depends(get_db),
):
    return await forgot_password(
        data.email,
        db,
    )

@router.post("/reset-password")
def reset_password_route(
    data: ResetPasswordSchema,
    db: Session = Depends(get_db),
):
    return reset_password(
        data.token,
        data.new_password,
        db,
    )

@router.post(
    "/change-password",
    status_code=status.HTTP_200_OK,
)
def change_current_user_password(
    payload: ChangePasswordSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    change_password(
        current_user=current_user,
        payload=payload,
        db=db,
    )

    return {
        "message": "Password changed successfully"
    }