from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import EmailStr

from app.schemas.base import BaseSchema


class LeadCreate(BaseSchema):
    apartment_id: UUID
    name: str
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    source: Optional[str] = None
    message: Optional[str] = None


class LeadUpdate(BaseSchema):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    source: Optional[str] = None
    status: Optional[str] = None
    message: Optional[str] = None


class LeadResponse(BaseSchema):
    id: UUID
    apartment_id: UUID

    name: str
    phone: Optional[str]
    email: Optional[EmailStr]
    source: Optional[str]
    status: str
    message: Optional[str]

    created_at: datetime
    updated_at: datetime