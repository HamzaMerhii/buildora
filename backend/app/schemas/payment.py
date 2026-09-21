from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema


class PaymentCreate(BaseSchema):
    project_id: UUID
    party_id: UUID
    category_id: UUID

    amount: Decimal = Field(
        ...,
        gt=0,
    )

    currency: str = "USD"
    payment_date: date

    description: Optional[str] = None
    reference: Optional[str] = None


class PaymentUpdate(BaseSchema):
    party_id: Optional[UUID] = None
    category_id: Optional[UUID] = None

    amount: Optional[Decimal] = Field(
        default=None,
        gt=0,
    )

    currency: Optional[str] = None
    payment_date: Optional[date] = None
    description: Optional[str] = None
    reference: Optional[str] = None


class PaymentResponse(PaymentCreate):
    id: UUID
    created_by: UUID
    created_at: datetime
    updated_at: datetime