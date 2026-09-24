from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema


class FloorCreate(BaseSchema):
    name: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    floor_number: int
    description: Optional[str] = Field(
        default=None,
        max_length=500,
    )

class FloorUpdate(BaseSchema):
    name: Optional[str] = Field(
        default=None,
        max_length=100,
    )
    floor_number: Optional[int] = Field(
        default=None,
        ge=0,
    )
    description: Optional[str] = Field(
        default=None,
        max_length=500,
    )


class FloorResponse(BaseSchema):
    id: UUID
    building_id: UUID

    name: Optional[str]
    floor_number: int
    description: Optional[str]

    created_at: datetime
    updated_at: datetime