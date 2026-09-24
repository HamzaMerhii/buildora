from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import EmailStr

from app.schemas.base import BaseSchema
from app.models.user import PlatformRole


class PlatformCompanyDetailsResponse(BaseSchema):
    id: UUID
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None
    logo: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

class PlatformCompanyUpdate(BaseSchema):
    is_active: Optional[bool] = None

class PlatformUserResponse(BaseSchema):
    id: UUID
    name: str
    email: EmailStr
    phone: Optional[str] = None

    platform_role: PlatformRole
    is_active: bool

    created_at: datetime
    updated_at: datetime

class PlatformUserUpdate(BaseSchema):
    is_active: Optional[bool] = None