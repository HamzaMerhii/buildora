from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import Field

from app.models import ProjectStatus
from app.schemas.base import BaseSchema
from app.models.task import TaskStatus


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
    progress_percent: int
    status: ProjectStatus

    budget: Optional[Decimal]
    image: Optional[str]
    created_at: datetime
    updated_at: datetime


class ProjectCreateResponse(BaseSchema):
    message: str



class ProjectProgressUpdateResponse(BaseSchema):
    id: UUID
    project_id: UUID
    progress_percent: int
    created_at: datetime


class ProjectActivityResponse(BaseSchema):
    id: UUID

    task_id: UUID
    task_title: str

    stage_id: UUID
    stage_name: str

    user_id: UUID
    user_name: str | None = None

    progress_percent: int
    status: TaskStatus

    notes: str | None = None
    photo_url: str | None = None

    created_at: datetime