from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models import PlatformRole
from app.models.company_membership import CompanyRole
from app.schemas.base import BaseSchema


class UserRegisterSchema(BaseModel):
    name: str = Field(
        ...,
        min_length=1,
        description="Name is required"
    )

    email: EmailStr

    phone: str = Field(
        ...,
        pattern=r"^\+?[0-9]{8,15}$",
        description="Valid phone number required"
    )

    password: str = Field(
        ...,
        min_length=8,
        description="Password must be at least 8 characters"
    )


class UserLoginSchema(BaseModel):
    email: EmailStr

    password: str = Field(
        ...,
        min_length=8,
        description="Password must be at least 8 characters"
    )


class Token(BaseModel):
    access_token: str
    token_type: str


class ForgotPasswordSchema(BaseModel):
    email: EmailStr


class ResetPasswordSchema(BaseModel):
    token: str

    new_password: str = Field(
        ...,
        min_length=8,
        max_length=128,
    )


class AuthMembershipContext(BaseSchema):
    company_id: UUID
    company_name: str
    role: CompanyRole


class SessionContextResponse(BaseSchema):
    id: UUID
    name: str
    email: EmailStr
    platform_role: PlatformRole
    memberships: list[AuthMembershipContext] = []