from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import Field

from app.models import ProjectStatus
from app.schemas.base import BaseSchema


class ProjectCreate(BaseSchema):
    name: str = Field(
        ...,
        min_length=1,
        max_length=200,
    )

    description: Optional[str] = None

    location: Optional[str] = None

    start_date: Optional[date] = None

    expected_end_date: Optional[date] = None

    status: ProjectStatus = ProjectStatus.PLANNING

    budget: Optional[Decimal] = Field(
        default=None,
        ge=0,
    )
    image: Optional[str] = None

class ProjectUpdate(BaseSchema):
    name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[date] = None
    expected_end_date: Optional[date] = None
    status: Optional[ProjectStatus] = None
    budget: Optional[Decimal] = None
    image: Optional[str] = None


class ProjectResponse(BaseSchema):
    id: UUID

    company_id: UUID
    created_by: UUID

    name: str
    description: Optional[str]
    location: Optional[str]

    start_date: Optional[date]
    expected_end_date: Optional[date]

    status: ProjectStatus

    budget: Optional[Decimal]
    image: Optional[str]
    created_at: datetime
    updated_at: datetime


class ProjectCreateResponse(BaseSchema):
    message: str