from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema


class PaymentCreate(BaseSchema):
    party_id: UUID
    category_id: UUID

    amount: Decimal = Field(
        ...,
        gt=0,
    )

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


class PaymentResponse(BaseSchema):
    id: UUID
    project_id: UUID

    party_id: Optional[UUID]
    category_id: Optional[UUID]

    amount: Decimal
    payment_date: date
    description: Optional[str]
    reference: Optional[str] = None
    created_by: UUID

    created_at: datetime
    updated_at: datetime