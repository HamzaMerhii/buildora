from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    PaymentCategory,
)
from app.schemas.payment_category import PaymentCategoryCreate



def create_payment_category(
    category: PaymentCategoryCreate,
    db: Session,
):
    existing_category = db.scalar(
        select(PaymentCategory).where(
            PaymentCategory.name == category.name
        )
    )

    if existing_category is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Payment category already exists",
        )

    new_category = PaymentCategory(
        **category.model_dump(),
    )

    db.add(new_category)
    db.commit()
    db.refresh(new_category)

    return new_category


def get_payment_categories(
    db: Session,
):
    categories = db.scalars(
        select(PaymentCategory)
        .order_by(
            PaymentCategory.name.asc()
        )
    ).all()

    return categories