from datetime import datetime
from typing import Optional
from uuid import UUID

from app.schemas.base import BaseSchema


class DocumentCreate(BaseSchema):
    project_id: UUID
    name: str
    file_url: str
    file_type: Optional[str] = None
    category: Optional[str] = None


class DocumentUpdate(BaseSchema):
    name: Optional[str] = None
    file_url: Optional[str] = None
    file_type: Optional[str] = None
    category: Optional[str] = None


class DocumentResponse(DocumentCreate):
    id: UUID
    uploaded_by: UUID
    uploaded_at: datetime