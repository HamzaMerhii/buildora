from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema

class PaymentCategoryCreate(BaseSchema):
    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
    )


class PaymentCategoryResponse(BaseSchema):
    id: UUID
    name: str
