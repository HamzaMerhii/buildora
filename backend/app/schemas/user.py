from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional

from app.models import PlatformRole


class UserBaseSchema(BaseModel):
    name: str = Field(...,
        min_length=1,
        description="Name is required"
    )
    email: EmailStr
    phone: str = Field(
        ...,
        pattern=r"^\+?[0-9]{8,15}$",
        description="Valid phone number required"
    )
class UserCreateSchema(UserBaseSchema):
    password: str = Field(
        ...,
        min_length=8,
        description="Password must be at least 8 characters"
    )

class UserUpdateSchema(BaseModel):
    name: Optional[str] = Field(
        None,
        min_length=1
    )

    email: Optional[EmailStr] = None

    phone: str = Field(
        ...,
        pattern=r"^\+?[0-9]{8,15}$"
    )

    password: Optional[str] = Field(
        None,
        min_length=8
    )

class UserUpdateByAdminSchema(UserUpdateSchema):
    platform_role: Optional[PlatformRole] = None
    is_active: Optional[bool] = None

class UserOutSchema(BaseModel):
    id: UUID
    name: str
    email: EmailStr
    phone: str
    platform_role: PlatformRole
    is_active: bool

    model_config = ConfigDict(
        from_attributes=True
    )


class UserPaginatedResponse(BaseModel):
    items: list[UserOutSchema]
    total: int
    page: int
    size: int
    pages: int


class UserFilterParams(BaseModel):
    page: int = Field(
        default=1,
        ge=1
    )

    size: int = Field(
        default=10,
        ge=1,
        le=100
    )

    platform_role: Optional[PlatformRole] = None
    is_active: Optional[bool] = None
    search: Optional[str] = None