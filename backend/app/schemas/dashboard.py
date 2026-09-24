from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID


from app.schemas.base import BaseSchema
from app.models.task import TaskStatus

class ProjectCountsResponse(BaseSchema):
    total: int
    planning: int
    in_progress: int
    completed: int
    on_hold: int


class DashboardProjectResponse(BaseSchema):
    project_id: UUID
    name: str

    budget: Decimal
    paid: Decimal
    remaining: Decimal

    progress_percent: int


class RecentPaymentResponse(BaseSchema):
    id: UUID
    project_id: UUID

    amount: Decimal
    payment_date: date

    description: str | None = None
    created_at: datetime


class CompanyDashboardSummaryResponse(BaseSchema):
    project_counts: ProjectCountsResponse

    total_budget: Decimal
    total_paid: Decimal
    remaining_budget: Decimal
    budget_utilization_percent: float

    open_leads: int

    projects: list[DashboardProjectResponse]

    recent_payments: list[RecentPaymentResponse]

class CompanyTaskResponse(BaseSchema):
    id: UUID
    title: str
    status: TaskStatus
    progress_percent: int

    assigned_to: Optional[UUID] = None

    start_date: Optional[date] = None
    due_date: Optional[date] = None

    stage_id: UUID
    stage_name: str

    project_id: UUID
    project_name: str


class ApartmentSalesCountsResponse(BaseSchema):
    total: int
    available: int
    reserved: int
    sold: int
    public: int


class TopEnquiredUnitResponse(BaseSchema):
    apartment_id: UUID
    unit_number: str

    project_id: UUID
    project_name: str

    lead_count: int


class CompanySalesDashboardResponse(BaseSchema):
    apartments: ApartmentSalesCountsResponse
    top_enquired_units: list[TopEnquiredUnitResponse]

class FinanceByProjectResponse(BaseSchema):
    project_id: UUID
    project_name: str
    total_paid: Decimal


class FinanceByCategoryResponse(BaseSchema):
    category_id: UUID
    category_name: str
    total_paid: Decimal


class FinanceRecentPaymentResponse(BaseSchema):
    id: UUID

    project_id: UUID
    project_name: str

    party_id: Optional[UUID] = None
    party_name: Optional[str] = None

    category_id: Optional[UUID] = None
    category_name: Optional[str] = None

    amount: Decimal
    payment_date: date

    reference: Optional[str] = None
    description: Optional[str] = None


class CompanyFinanceDashboardResponse(BaseSchema):
    total_paid: Decimal
    payment_count: int
    payments_this_month: Decimal
    projects_covered: int

    by_project: list[FinanceByProjectResponse]
    by_category: list[FinanceByCategoryResponse]
    recent_payments: list[FinanceRecentPaymentResponse]