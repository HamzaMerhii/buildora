from datetime import date
from decimal import Decimal
from enum import Enum
from typing import Annotated, Any, Literal, Optional, Union

from pydantic import BaseModel, Field

from app.models.apartment import ApartmentStatus
from app.models.project import ProjectStatus
from app.models.task import TaskStatus


class AIIntent(str, Enum):
    SEARCH_PROJECTS = "SEARCH_PROJECTS"
    SEARCH_TASKS = "SEARCH_TASKS"
    SEARCH_APARTMENTS = "SEARCH_APARTMENTS"
    SEARCH_PAYMENTS = "SEARCH_PAYMENTS"
    PROJECT_FINANCIAL_SUMMARY = "PROJECT_FINANCIAL_SUMMARY"
    PROJECT_PROGRESS_SUMMARY = "PROJECT_PROGRESS_SUMMARY"
    PAYMENT_SUMMARY = "PAYMENT_SUMMARY"
    TASK_SUMMARY = "TASK_SUMMARY"
    APARTMENT_SUMMARY = "APARTMENT_SUMMARY"
    PROJECT_REPORT = "PROJECT_REPORT"
    UNKNOWN = "UNKNOWN"


class AISearchRequest(BaseModel):
    query: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="Natural-language question for Buildora AI search",
        examples=[
            "Which tasks are overdue?"
        ],
    )


class TaskFilters(BaseModel):
    status: Optional[TaskStatus] = None
    overdue: Optional[bool] = None

    project_name: Optional[str] = Field(
        default=None,
        max_length=255,
    )


class ProjectFilters(BaseModel):
    name: Optional[str] = Field(
        default=None,
        max_length=255,
    )

    status: Optional[ProjectStatus] = None

    location: Optional[str] = Field(
        default=None,
        max_length=255,
    )


class ApartmentFilters(BaseModel):
    status: Optional[ApartmentStatus] = None

    bedrooms: Optional[int] = Field(
        default=None,
        ge=0,
    )

    min_price: Optional[Decimal] = Field(
        default=None,
        ge=0,
    )

    max_price: Optional[Decimal] = Field(
        default=None,
        ge=0,
    )

    project_name: Optional[str] = Field(
        default=None,
        max_length=255,
    )


class PaymentFilters(BaseModel):
    project_name: Optional[str] = Field(
        default=None,
        max_length=255,
    )

    party_name: Optional[str] = Field(
        default=None,
        max_length=255,
    )

    category_name: Optional[str] = Field(
        default=None,
        max_length=255,
    )

    start_date: Optional[date] = None
    end_date: Optional[date] = None

    min_amount: Optional[Decimal] = Field(
        default=None,
        ge=0,
    )

    max_amount: Optional[Decimal] = Field(
        default=None,
        ge=0,
    )


class ProjectFinancialFilters(BaseModel):
    project_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
    )

class ProjectProgressFilters(BaseModel):
    project_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
    )

class PaymentPeriod(str, Enum):
    TODAY = "today"
    THIS_MONTH = "this_month"
    LAST_MONTH = "last_month"
    THIS_YEAR = "this_year"


class PaymentSummaryFilters(BaseModel):
    project_name: Optional[str] = Field(
        default=None,
        max_length=255,
    )

    party_name: Optional[str] = Field(
        default=None,
        max_length=255,
    )

    category_name: Optional[str] = Field(
        default=None,
        max_length=255,
    )

    start_date: Optional[date] = None
    end_date: Optional[date] = None

    period: Optional[PaymentPeriod] = None

class TaskSummaryFilters(BaseModel):
    project_name: Optional[str] = Field(
        default=None,
        max_length=255,
    )
class ApartmentSummaryFilters(BaseModel):
    project_name: Optional[str] = Field(
        default=None,
        max_length=255,
    )
class ProjectReportFilters(BaseModel):
    project_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
    )

class ParsedTaskQuery(BaseModel):
    intent: Literal[AIIntent.SEARCH_TASKS]
    filters: TaskFilters = Field(
        default_factory=TaskFilters
    )


class ParsedProjectQuery(BaseModel):
    intent: Literal[AIIntent.SEARCH_PROJECTS]
    filters: ProjectFilters = Field(
        default_factory=ProjectFilters
    )


class ParsedApartmentQuery(BaseModel):
    intent: Literal[AIIntent.SEARCH_APARTMENTS]
    filters: ApartmentFilters = Field(
        default_factory=ApartmentFilters
    )


class ParsedPaymentQuery(BaseModel):
    intent: Literal[AIIntent.SEARCH_PAYMENTS]
    filters: PaymentFilters = Field(
        default_factory=PaymentFilters
    )


class ParsedProjectFinancialQuery(BaseModel):
    intent: Literal[
        AIIntent.PROJECT_FINANCIAL_SUMMARY
    ]
    filters: ProjectFinancialFilters

class ParsedProjectProgressQuery(BaseModel):
    intent: Literal[
        AIIntent.PROJECT_PROGRESS_SUMMARY
    ]
    filters: ProjectProgressFilters

class ParsedPaymentSummaryQuery(BaseModel):
    intent: Literal[
        AIIntent.PAYMENT_SUMMARY
    ]

    filters: PaymentSummaryFilters = Field(
        default_factory=PaymentSummaryFilters
    )

class ParsedTaskSummaryQuery(BaseModel):
    intent: Literal[AIIntent.TASK_SUMMARY]

    filters: TaskSummaryFilters = Field(
        default_factory=TaskSummaryFilters
    )

class ParsedApartmentSummaryQuery(BaseModel):
    intent: Literal[AIIntent.APARTMENT_SUMMARY]

    filters: ApartmentSummaryFilters = Field(
        default_factory=ApartmentSummaryFilters
    )
class ParsedProjectReportQuery(BaseModel):
    intent: Literal[
        AIIntent.PROJECT_REPORT
    ]
    filters: ProjectReportFilters

class ParsedUnknownQuery(BaseModel):
    intent: Literal[AIIntent.UNKNOWN]
    filters: None = None


ParsedAIQuery = Annotated[
    Union[
        ParsedTaskQuery,
        ParsedProjectQuery,
        ParsedApartmentQuery,
        ParsedPaymentQuery,
        ParsedProjectFinancialQuery,
        ParsedProjectProgressQuery,
        ParsedPaymentSummaryQuery,
        ParsedTaskSummaryQuery,
        ParsedApartmentSummaryQuery,
        ParsedProjectReportQuery,
        ParsedUnknownQuery,
    ],
    Field(discriminator="intent"),
]


AIFilters = Union[
    TaskFilters,
    ProjectFilters,
    ApartmentFilters,
    PaymentFilters,
    ProjectFinancialFilters,
    ProjectFinancialFilters,
    PaymentSummaryFilters,
    ApartmentSummaryFilters,
    ProjectReportFilters,
    TaskSummaryFilters,
    ProjectProgressFilters
]


class AISearchResponse(BaseModel):
    query: str
    intent: AIIntent
    filters: Optional[AIFilters] = None
    answer: str

    count: int = Field(
        ...,
        ge=0,
    )

    results: list[dict[str, Any]]