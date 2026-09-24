from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema
from app.models.task import TaskStatus


class TaskCreate(BaseSchema):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None

    assigned_to: Optional[UUID] = None
    party_id: Optional[UUID] = None

    start_date: Optional[date] = None
    due_date: Optional[date] = None

    status: TaskStatus = TaskStatus.NOT_STARTED

    progress_percent: int = Field(
        default=0,
        ge=0,
        le=100,
    )


class TaskUpdate(BaseSchema):
    title: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=200,
    )

    description: Optional[str] = None

    assigned_to: Optional[UUID] = None
    party_id: Optional[UUID] = None

    start_date: Optional[date] = None
    due_date: Optional[date] = None

    status: Optional[TaskStatus] = None

    progress_percent: Optional[int] = Field(
        default=None,
        ge=0,
        le=100,
    )

class TaskResponse(BaseSchema):
    id: UUID
    stage_id: UUID

    title: str
    description: Optional[str]

    assigned_to: Optional[UUID]
    party_id: Optional[UUID]

    start_date: Optional[date]
    due_date: Optional[date]

    status: TaskStatus
    progress_percent: int

    created_at: datetime
    updated_at: datetime