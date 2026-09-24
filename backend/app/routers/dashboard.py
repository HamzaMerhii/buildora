from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.dependencies.permissions import require_company_owner,require_finance,require_site_management,require_sales
from app.models.user import User
from app.schemas.dashboard import CompanyDashboardSummaryResponse, CompanyFinanceDashboardResponse, CompanySalesDashboardResponse, CompanyTaskResponse
from app.services.dashboard_service import get_company_dashboard_summary, get_company_finance_dashboard, get_company_sales_dashboard, get_company_tasks


router = APIRouter(
    prefix="/companies/{company_id}/dashboard",
    tags=["Company Dashboard"],
)


@router.get(
    "/summary",
    response_model=CompanyDashboardSummaryResponse,
)
def company_dashboard_summary(
    company_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_company_owner),
):
    return get_company_dashboard_summary(
        company_id=company_id,
        db=db,
    )

@router.get(
    "/tasks",
    response_model=list[CompanyTaskResponse],
)
def list_company_tasks(
    company_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_site_management),
):
    return get_company_tasks(
        company_id=company_id,
        db=db,
    )

@router.get(
    "/sales",
    response_model=CompanySalesDashboardResponse,
)
def company_sales_dashboard(
    company_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales),
):
    return get_company_sales_dashboard(
        company_id=company_id,
        db=db,
    )

@router.get(
    "/finance",
    response_model=CompanyFinanceDashboardResponse,
)
def company_finance_dashboard(
    company_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_finance),
):
    return get_company_finance_dashboard(
        company_id=company_id,
        db=db,
    )