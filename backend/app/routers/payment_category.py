from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.dependencies.permissions import require_super_admin,require_authenticated_user
from app.dependencies import require_project_manager
from app.models import User
from app.schemas.payment_category import (
    PaymentCategoryCreate,
    PaymentCategoryResponse,
)
from app.services.payment_category_service import (create_payment_category,get_payment_categories)


router = APIRouter(
    prefix=(
        "/payment-categories"
    ),
    tags=["Category Payments"],
)

@router.post(
    "/",
    response_model=PaymentCategoryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_payment_category(
    category: PaymentCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return create_payment_category(
        category=category,
        db=db,
    )


@router.get(
    "/",
    response_model=list[PaymentCategoryResponse],
)
def list_payment_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated_user),
):
    return get_payment_categories(
        db=db,
    )