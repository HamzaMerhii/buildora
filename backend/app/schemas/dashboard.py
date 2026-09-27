from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID


from app.schemas.base import BaseSchema
from app.models.task import TaskStatus
from app.models.project import ProjectStatus

class ProjectCountsResponse(BaseSchema):
    total: int
    planning: int
    in_progress: int
    completed: int
    on_hold: int


class DashboardApartmentCountsResponse(BaseSchema):
    total: int
    public: int
    private: int


class DashboardProjectResponse(BaseSchema):
    project_id: UUID
    name: str

    location: Optional[str] = None
    status: ProjectStatus
    image: Optional[str] = None

    budget: Decimal
    paid: Decimal
    remaining: Decimal

    progress_percent: int

    current_stage: Optional[str] = None


class DashboardCategoryPaymentResponse(BaseSchema):
    category_id: UUID
    category_name: str
    total_paid: Decimal


class DashboardRecentPaymentResponse(BaseSchema):
    id: UUID

    project_id: UUID
    project_name: str

    party_name: Optional[str] = None
    category_name: Optional[str] = None
    reference: Optional[str] = None

    amount: Decimal
    payment_date: date
    description: Optional[str] = None


class DashboardTaskResponse(BaseSchema):
    id: UUID
    title: str

    status: TaskStatus
    progress_percent: int

    assigned_to: Optional[UUID] = None
    assigned_to_name: Optional[str] = None

    start_date: Optional[date] = None
    due_date: Optional[date] = None

    stage_id: UUID
    stage_name: str

    project_id: UUID
    project_name: str


class CompanyDashboardSummaryResponse(BaseSchema):
    project_counts: ProjectCountsResponse

    apartments: DashboardApartmentCountsResponse

    total_budget: Decimal
    total_paid: Decimal
    remaining_budget: Decimal
    budget_utilization_percent: float

    open_leads: int

    projects: list[DashboardProjectResponse]

    by_category: list[DashboardCategoryPaymentResponse]

    recent_payments: list[DashboardRecentPaymentResponse]

    tasks: list[DashboardTaskResponse]

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


class TopEnquiredApartmentResponse(BaseSchema):
    apartment_id: UUID
    unit_number: str

    project_id: UUID
    project_name: str

    lead_count: int

    is_public: bool

    price: Decimal | None = None
    bedrooms: int | None = None
    bathrooms: int | None = None
    area_sqm: Decimal | None = None

    floor_number: int | None = None

    primary_image: str | None = None


class CompanySalesDashboardResponse(BaseSchema):
    apartments: ApartmentSalesCountsResponse

    top_enquired_apartments: list[
        TopEnquiredApartmentResponse
    ]
class FinanceByProjectResponse(BaseSchema):
    project_id: UUID
    project_name: str

    budget: Decimal
    total_paid: Decimal
    remaining: Decimal

    current_stage_name: Optional[str] = None


class FinanceByCategoryResponse(BaseSchema):
    category_id: UUID
    category_name: str
    total_paid: Decimal


class FinanceTopPaidPartyResponse(BaseSchema):
    party_id: UUID
    party_name: str
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

    total_project_budget: Decimal
    remaining_balance: Decimal

    payment_count: int

    payments_this_month: Decimal
    payments_this_month_count: int

    projects_covered: int

    by_project: list[FinanceByProjectResponse]
    by_category: list[FinanceByCategoryResponse]

    top_paid_parties: list[FinanceTopPaidPartyResponse]

    recent_payments: list[FinanceRecentPaymentResponse]