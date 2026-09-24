from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Project,
    Party,
    Payment,
    PaymentCategory,
    User,
)
from app.schemas.payment import PaymentCreate


def create_payment(
    company_id: UUID,
    project_id: UUID,
    payment: PaymentCreate,
    current_user: User,
    db: Session,
):
    # Verify project belongs to company
    project = db.scalar(
        select(Project).where(
            Project.id == project_id,
            Project.company_id == company_id,
        )
    )

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # If party is provided,
    # verify it belongs to the same company
    if payment.party_id is not None:
        party = db.scalar(
            select(Party).where(
                Party.id == payment.party_id,
                Party.company_id == company_id,
            )
        )

        if party is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Party does not belong to this company",
            )

    # Validate payment category if provided
    if payment.category_id is not None:
        category = db.scalar(
            select(PaymentCategory).where(
                PaymentCategory.id == payment.category_id
            )
        )

        if category is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment category not found",
            )

    new_payment = Payment(
        **payment.model_dump(),
        project_id=project_id,
        created_by=current_user.id,
    )

    db.add(new_payment)
    db.commit()
    db.refresh(new_payment)

    return new_payment


def get_project_payments(
    company_id: UUID,
    project_id: UUID,
    db: Session,
):
    # Verify project belongs to company
    project = db.scalar(
        select(Project).where(
            Project.id == project_id,
            Project.company_id == company_id,
        )
    )

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    payments = db.scalars(
        select(Payment)
        .where(
            Payment.project_id == project_id
        )
        .order_by(
            Payment.payment_date.desc(),
            Payment.created_at.desc(),
        )
    ).all()

    return payments


def get_payment_details(
    company_id: UUID,
    project_id: UUID,
    payment_id: UUID,
    db: Session,
):
    # Verify project belongs to company
    project = db.scalar(
        select(Project).where(
            Project.id == project_id,
            Project.company_id == company_id,
        )
    )

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Verify payment belongs to project
    payment = db.scalar(
        select(Payment).where(
            Payment.id == payment_id,
            Payment.project_id == project_id,
        )
    )

    if payment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )

    return payment