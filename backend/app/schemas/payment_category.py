from typing import Optional
from uuid import UUID

from app.schemas.base import BaseSchema


class PaymentCategoryCreate(BaseSchema):
    name: str
    description: Optional[str] = None


class PaymentCategoryUpdate(BaseSchema):
    name: Optional[str] = None
    description: Optional[str] = None


class PaymentCategoryResponse(PaymentCategoryCreate):
    id: UUID