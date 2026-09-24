from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import EmailStr,Field

from app.schemas.base import BaseSchema
from app.models.lead import LeadStatus


class LeadCreate(BaseSchema):
    name: str = Field(
        ...,
        min_length=1,
        max_length=200,
    )

    phone: Optional[str] = Field(
        default=None,
        max_length=30,
    )

    email: Optional[EmailStr] = None

    message: Optional[str] = None


class LeadUpdate(BaseSchema):
    status: Optional[LeadStatus] = None

    message: Optional[str] = None


class LeadResponse(BaseSchema):
    id: UUID
    apartment_id: UUID

    name: str
    phone: Optional[str]
    email: Optional[EmailStr]
    message: Optional[str]

    status: LeadStatus

    created_at: datetime
    updated_at: datetime