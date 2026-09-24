from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import Field
from app.schemas.base import BaseSchema


class DocumentCreate(BaseSchema):
    name: str = Field(
        ...,
        min_length=1,
        max_length=200,
    )

    category: Optional[str] = Field(
        default=None,
        max_length=100,
    )



class DocumentResponse(BaseSchema):
    id: UUID
    project_id: UUID
    uploaded_by: Optional[UUID]

    name: str
    category: Optional[str]

    file_url: str
    file_type: Optional[str]
    original_filename: Optional[str]

    created_at: datetime