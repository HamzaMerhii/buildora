from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from app.schemas.base import BaseSchema
from pydantic import Field

class LandRecordCreate(BaseSchema):
    project_id: UUID
    area_sqm: Optional[Decimal] = Field(
        default=None,
        gt=0,
    )
    parcel_number: Optional[str] = None

    max_height_m: Optional[Decimal] = Field(
        default=None,
        ge=0,
    )

    building_ratio: Optional[Decimal] = Field(
        default=None,
        ge=0,
    )
    constraints: Optional[str] = None
    notes: Optional[str] = None

class LandRecordUpdate(BaseSchema):
    area_sqm: Optional[Decimal] = Field(
        default=None,
        gt=0,
    )

    parcel_number: Optional[str] = None

    max_height_m: Optional[Decimal] = Field(
        default=None,
        ge=0,
    )

    building_ratio: Optional[Decimal] = Field(
        default=None,
        ge=0,
    )

    constraints: Optional[str] = None
    notes: Optional[str] = None


class LandRecordResponse(BaseSchema):
    id: UUID
    project_id: UUID

    area_sqm: Optional[Decimal]
    parcel_number: Optional[str]
    max_height_m: Optional[Decimal]
    building_ratio: Optional[Decimal]
    constraints: Optional[str]
    notes: Optional[str]

    created_at: datetime
    updated_at: datetime