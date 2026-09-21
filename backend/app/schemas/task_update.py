from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import Field

from app.models.task import TaskStatus
from app.schemas.base import BaseSchema


class TaskUpdateCreate(BaseSchema):
    progress_percent: int = Field(
        ...,
        ge=0,
        le=100,
    )

    status: TaskStatus

    notes: Optional[str] = None


class TaskUpdateResponse(BaseSchema):
    id: UUID

    task_id: UUID
    user_id: UUID

    progress_percent: int
    status: TaskStatus

    notes: Optional[str]
    photo_url: Optional[str]

    created_at: datetime