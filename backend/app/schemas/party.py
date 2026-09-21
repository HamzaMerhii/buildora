from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import EmailStr, Field


from app.schemas.base import BaseSchema
from app.models.party import PartyType


class PartyCreate(BaseSchema):
    name: str = Field(
        ...,
        min_length=1,
        max_length=200,
    )

    type: PartyType

    email: Optional[EmailStr] = None

    phone: Optional[str] = Field(
        default=None,
        max_length=30,
    )

    address: Optional[str] = None

    notes: Optional[str] = None

class PartyUpdate(BaseSchema):
    name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=200,
    )

    type: Optional[PartyType] = None

    email: Optional[EmailStr] = None

    phone: Optional[str] = Field(
        default=None,
        max_length=30,
    )

    address: Optional[str] = None

    notes: Optional[str] = None

class PartyResponse(BaseSchema):
    id: UUID

    name: str
    type: PartyType

    email: Optional[EmailStr]
    phone: Optional[str]
    address: Optional[str]
    notes: Optional[str]

    created_at: datetime
    updated_at: datetime