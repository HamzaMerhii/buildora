from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import File, UploadFile
from pydantic import EmailStr, Field

from app.schemas.base import BaseSchema
from app.models.company_membership import CompanyRole


class CompanyBase(BaseSchema):
    name: str = Field(
        ...,
        min_length=1,
        max_length=200,
    )

    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    logo: Optional[str] = None


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(BaseSchema):
    name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=200,
    )

    phone: Optional[str] = Field(
        default=None,
        max_length=30,
    )

    email: Optional[str] = Field(
        default=None,
        max_length=200,
    )

    address: Optional[str] = Field(
        default=None,
        max_length=500,
    )

    description: Optional[str] = None
    logo: UploadFile | None = File(None)


class CompanyResponse(CompanyBase):
    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

class CompanyMemberUserResponse(BaseSchema):
    id: UUID
    name: str
    email: EmailStr
    phone: Optional[str]


class CompanyMemberResponse(BaseSchema):
    id: UUID
    user_id: UUID
    company_id: UUID

    role: CompanyRole
    is_active: bool
    
    user: CompanyMemberUserResponse


class CompanyMemberCreate(BaseSchema):
    name: str = Field(
        ...,
        min_length=1,
        max_length=200,
    )
    email: EmailStr
    phone: str = Field(
        ...,
        pattern=r"^\+?[0-9]{8,15}$",
    )
    password: str = Field(
        ...,
        min_length=8,
    )
    role: CompanyRole

class CompanyMemberUpdate(BaseSchema):
    role: Optional[CompanyRole] = None
    is_active: Optional[bool] = None