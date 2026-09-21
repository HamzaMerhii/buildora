from datetime import date, datetime
from typing import Optional
from uuid import UUID
from pydantic import  Field, model_validator

from app.schemas.base import BaseSchema

class ConstructionStageCreate(BaseSchema):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    status: str = "not_started"


class ConstructionStageUpdate(BaseSchema):
    name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=200,
    )
    description: Optional[str] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    status: Optional[str] = None


class ConstructionStageResponse(BaseSchema):
    id: UUID
    project_id: UUID
    name: str
    description: Optional[str]
    order_index: int
    start_date: Optional[date]
    due_date: Optional[date]
    status: str
    created_at: datetime
    updated_at: datetime


class StageReorderItem(BaseSchema):
    stage_id: UUID
    order_index: int = Field(..., ge=0)


class StageReorderRequest(BaseSchema):
    stages: list[StageReorderItem]

    @model_validator(mode="after")
    def validate_reorder(self):
        if not self.stages:
            raise ValueError("At least one stage is required")

        stage_ids = [
            item.stage_id
            for item in self.stages
        ]

        order_indexes = [
            item.order_index
            for item in self.stages
        ]

        # Prevent the same stage from being sent twice.
        if len(stage_ids) != len(set(stage_ids)):
            raise ValueError(
                "Duplicate stage_id values are not allowed"
            )

        # Prevent two stages from having the same position.
        if len(order_indexes) != len(set(order_indexes)):
            raise ValueError(
                "Duplicate order_index values are not allowed"
            )

        # Require indexes such as:
        # 0, 1, 2, 3...
        expected_indexes = list(
            range(len(self.stages))
        )

        if sorted(order_indexes) != expected_indexes:
            raise ValueError(
                "order_index values must start from 0 "
                "and be continuous"
            )

        return self