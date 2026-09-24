from uuid import UUID

from fastapi import APIRouter, Depends, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database.db import get_db
from app.dependencies.permissions import require_finance
from app.models import Company, Project, Payment, User
from app.schemas.payment import (
    PaymentCreate,
    PaymentResponse,
)
from app.services.payment_service import (create_payment,get_project_payments,get_payment_details)
from app.services.payment_invoice_service import (
    InvoiceCompany,
    InvoiceParty,
    InvoicePaymentData,
    InvoiceProject,
    generate_payment_invoice_pdf,
)


router = APIRouter(
    prefix=(
        "/companies/{company_id}"
        "/projects/{project_id}"
        "/payments"
    ),
    tags=["Payments"],
)


@router.post(
    "/",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_payment(
    company_id: UUID,
    project_id: UUID,
    payment: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_finance),
):
    return create_payment(
        company_id=company_id,
        project_id=project_id,
        payment=payment,
        current_user=current_user,
        db=db,
    )

@router.get(
    "/",
    response_model=list[PaymentResponse],
)
def list_payments(
    company_id: UUID,
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_finance),
):
    return get_project_payments(
        company_id=company_id,
        project_id=project_id,
        db=db,
    )

@router.get(
    "/{payment_id}/invoice",
)
def download_payment_invoice(
    company_id: UUID,
    project_id: UUID,
    payment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_finance),
):
    from fastapi import HTTPException

    company = db.scalar(
        select(Company).where(Company.id == company_id)
    )
    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )
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
    payment = db.scalar(
        select(Payment)
        .options(
            selectinload(Payment.party),
            selectinload(Payment.category),
            selectinload(Payment.creator),
        )
        .where(
            Payment.id == payment_id,
            Payment.project_id == project_id,
        )
    )
    if payment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )

    import re

    raw_reference = payment.reference or f"pay-{str(payment.id)[:8]}"
    safe_reference = re.sub(r"[^A-Za-z0-9-_]", "", raw_reference) or f"pay-{str(payment.id)[:8]}"
    filename = f"payment-invoice-{safe_reference}.pdf"

    pdf_bytes = generate_payment_invoice_pdf(
        company=InvoiceCompany(
            name=company.name,
            email=company.email,
            phone=company.phone,
            address=company.address,
            logo_url=company.logo,
        ),
        project=InvoiceProject(
            name=project.name,
            location=project.location,
        ),
        party=InvoiceParty(
            name=payment.party.name,
            type_label=str(payment.party.type.value if hasattr(payment.party.type, "value") else payment.party.type).replace("_", " ").title(),
            phone=payment.party.phone,
            email=payment.party.email,
            address=payment.party.address,
        ),
        payment=InvoicePaymentData(
            reference=payment.reference,
            short_id=str(payment.id)[:8],
            payment_date=payment.payment_date,
            category_name=payment.category.name if payment.category else None,
            amount=payment.amount,
            description=payment.description,
            created_by_name=payment.creator.name if payment.creator else None,
            created_at=payment.created_at,
        ),
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/{payment_id}",
    response_model=PaymentResponse,
)
def get_payment(
    company_id: UUID,
    project_id: UUID,
    payment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_finance),
):
    return get_payment_details(
        company_id=company_id,
        project_id=project_id,
        payment_id=payment_id,
        db=db,
    )