from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema


class BuildingCreate(BaseSchema):
    name: str = Field(
        ...,
        min_length=1,
        max_length=200,
    )

    description: Optional[str] = None


class BuildingUpdate(BaseSchema):
    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    description: str | None = Field(
        default=None,
        max_length=500,
    )


class BuildingResponse(BaseSchema):
    id: UUID
    project_id: UUID
    name: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime