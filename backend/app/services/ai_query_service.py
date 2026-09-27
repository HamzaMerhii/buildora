from calendar import monthrange
from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.apartment import Apartment
from app.models.building import Building
from app.models.construction_stage import ConstructionStage, ConstructionStageStatus
from app.models.floor import Floor
from app.models.project import Project
from app.models.task import Task, TaskStatus
from app.schemas.ai import (
    ApartmentFilters,
    ApartmentSummaryFilters,
    PaymentFilters,
    PaymentSummaryFilters,
    ProjectFilters,
    ProjectFinancialFilters,
    ProjectProgressFilters,
    ProjectReportFilters,
    TaskFilters,
    TaskSummaryFilters,
)
from app.models.party import Party
from app.models.payment import Payment
from app.models.payment_category import PaymentCategory


def search_tasks(
    db: Session,
    company_id: UUID,
    filters: TaskFilters,
):
    """
    Search tasks belonging only to the given company.

    Tenant path:
    Task
    -> ConstructionStage
    -> Project
    -> company_id
    """

    stmt = (
        select(Task)
        .join(
            ConstructionStage,
            Task.stage_id == ConstructionStage.id,
        )
        .join(
            Project,
            ConstructionStage.project_id == Project.id,
        )
        .where(
            Project.company_id == company_id
        )
    )

    if filters.overdue is True:
        stmt = stmt.where(
            Task.due_date.is_not(None),
            Task.due_date < date.today(),
            Task.status != TaskStatus.COMPLETED,
        )

    if filters.status is not None:
        stmt = stmt.where(
            Task.status == filters.status
        )

    if filters.project_name:
        stmt = stmt.where(
            Project.name.ilike(
                f"%{filters.project_name}%"
            )
        )

    stmt = stmt.order_by(
        Task.due_date.asc().nulls_last(),
        Task.created_at.desc(),
    )

    return db.scalars(stmt).all()


def search_projects(
    db: Session,
    company_id: UUID,
    filters: ProjectFilters,
):
    """
    Search projects belonging only
    to the given company.
    """

    stmt = (
        select(Project)
        .where(
            Project.company_id == company_id
        )
    )

    if filters.name:
        stmt = stmt.where(
            Project.name.ilike(
                f"%{filters.name}%"
            )
        )

    if filters.status is not None:
        stmt = stmt.where(
            Project.status == filters.status
        )

    if filters.location:
        stmt = stmt.where(
            Project.location.ilike(
                f"%{filters.location}%"
            )
        )

    stmt = stmt.order_by(
        Project.created_at.desc()
    )

    return db.scalars(stmt).all()


def search_apartments(
    db: Session,
    company_id: UUID,
    filters: ApartmentFilters,
):
    """
    Search apartments safely inside one company.

    Tenant path:
    Apartment
    -> Floor
    -> Building
    -> Project
    -> company_id
    """

    stmt = (
        select(Apartment)
        .join(
            Floor,
            Apartment.floor_id == Floor.id,
        )
        .join(
            Building,
            Floor.building_id == Building.id,
        )
        .join(
            Project,
            Building.project_id == Project.id,
        )
        .where(
            Project.company_id == company_id
        )
    )

    if filters.status is not None:
        stmt = stmt.where(
            Apartment.status == filters.status.value
        )

    if filters.bedrooms is not None:
        stmt = stmt.where(
            Apartment.bedrooms == filters.bedrooms
        )

    if filters.min_price is not None:
        stmt = stmt.where(
            Apartment.price.is_not(None),
            Apartment.price >= filters.min_price,
        )

    if filters.max_price is not None:
        stmt = stmt.where(
            Apartment.price.is_not(None),
            Apartment.price <= filters.max_price,
        )

    if filters.project_name:
        stmt = stmt.where(
            Project.name.ilike(
                f"%{filters.project_name}%"
            )
        )

    stmt = stmt.order_by(
        Apartment.created_at.desc()
    )

    return db.scalars(stmt).all()


def search_payments(
    db: Session,
    company_id: UUID,
    filters: PaymentFilters,
):
    """
    Search payments safely inside one company.

    Tenant path:
    Payment
    -> Project
    -> company_id
    """

    stmt = (
        select(Payment)
        .join(
            Project,
            Payment.project_id == Project.id,
        )
        .join(
            Party,
            Payment.party_id == Party.id,
        )
        .join(
            PaymentCategory,
            Payment.category_id == PaymentCategory.id,
        )
        .where(
            Project.company_id == company_id
        )
    )

    if filters.project_name:
        stmt = stmt.where(
            Project.name.ilike(
                f"%{filters.project_name}%"
            )
        )

    if filters.party_name:
        stmt = stmt.where(
            Party.name.ilike(
                f"%{filters.party_name}%"
            )
        )

    if filters.category_name:
        stmt = stmt.where(
            PaymentCategory.name.ilike(
                f"%{filters.category_name}%"
            )
        )

    if filters.start_date is not None:
        stmt = stmt.where(
            Payment.payment_date >= filters.start_date
        )

    if filters.end_date is not None:
        stmt = stmt.where(
            Payment.payment_date <= filters.end_date
        )

    if filters.min_amount is not None:
        stmt = stmt.where(
            Payment.amount >= filters.min_amount
        )

    if filters.max_amount is not None:
        stmt = stmt.where(
            Payment.amount <= filters.max_amount
        )

    stmt = stmt.order_by(
        Payment.payment_date.desc(),
        Payment.created_at.desc(),
    )

    return db.scalars(stmt).all()

def get_project_financial_summary(
    db: Session,
    company_id: UUID,
    filters: ProjectFinancialFilters,
):
    project = db.scalar(
        select(Project).where(
            Project.company_id == company_id,
            Project.name.ilike(
                f"%{filters.project_name}%"
            ),
        )
    )

    if project is None:
        return None

    total_spent = db.scalar(
        select(
            func.coalesce(
                func.sum(Payment.amount),
                0,
            )
        ).where(
            Payment.project_id == project.id
        )
    )

    budget = project.budget

    remaining_budget = (
        budget - total_spent
        if budget is not None
        else None
    )

    return {
        "project_id": str(project.id),
        "project_name": project.name,
        "budget": (
            float(budget)
            if budget is not None
            else None
        ),
        "total_spent": float(total_spent),
        "remaining_budget": (
            float(remaining_budget)
            if remaining_budget is not None
            else None
        ),
    }

def get_project_progress_summary(
    db: Session,
    company_id: UUID,
    filters: ProjectProgressFilters,
):
    project = db.scalar(
        select(Project).where(
            Project.company_id == company_id,
            Project.name.ilike(
                f"%{filters.project_name}%"
            ),
        )
    )

    if project is None:
        return None

    return {
        "project_id": str(project.id),
        "project_name": project.name,
        "status": project.status.value,
        "progress_percent": project.progress_percent,
        "start_date": (
            project.start_date.isoformat()
            if project.start_date
            else None
        ),
        "expected_end_date": (
            project.expected_end_date.isoformat()
            if project.expected_end_date
            else None
        ),
    }


def resolve_payment_period(period):
    today = date.today()

    if period is None:
        return None, None

    if period.value == "today":
        return today, today

    if period.value == "this_month":
        start_date = today.replace(day=1)

        end_date = today.replace(
            day=monthrange(
                today.year,
                today.month,
            )[1]
        )

        return start_date, end_date

    if period.value == "last_month":
        if today.month == 1:
            year = today.year - 1
            month = 12
        else:
            year = today.year
            month = today.month - 1

        start_date = date(
            year,
            month,
            1,
        )

        end_date = date(
            year,
            month,
            monthrange(
                year,
                month,
            )[1],
        )

        return start_date, end_date

    if period.value == "this_year":
        return (
            date(today.year, 1, 1),
            date(today.year, 12, 31),
        )

    return None, None

def get_payment_summary(
    db: Session,
    company_id: UUID,
    filters: PaymentSummaryFilters,
):
    """
    Return an aggregated payment summary for one company.

    Supports:
    - project_name
    - party_name
    - category_name
    - explicit start_date / end_date
    - relative period
    """

    stmt = (
        select(
            func.count(Payment.id),
            func.coalesce(
                func.sum(Payment.amount),
                0,
            ),
        )
        .join(
            Project,
            Payment.project_id == Project.id,
        )
        .join(
            Party,
            Payment.party_id == Party.id,
        )
        .join(
            PaymentCategory,
            Payment.category_id == PaymentCategory.id,
        )
        .where(
            Project.company_id == company_id
        )
    )

    # -----------------------------------
    # TEXT FILTERS
    # -----------------------------------

    if filters.project_name:
        stmt = stmt.where(
            Project.name.ilike(
                f"%{filters.project_name}%"
            )
        )

    if filters.party_name:
        stmt = stmt.where(
            Party.name.ilike(
                f"%{filters.party_name}%"
            )
        )

    if filters.category_name:
        stmt = stmt.where(
            PaymentCategory.name.ilike(
                f"%{filters.category_name}%"
            )
        )

    # -----------------------------------
    # DATE RANGE
    # -----------------------------------

    period_start, period_end = resolve_payment_period(
        filters.period
    )

    start_date = (
        filters.start_date
        if filters.start_date is not None
        else period_start
    )

    end_date = (
        filters.end_date
        if filters.end_date is not None
        else period_end
    )

    if start_date is not None:
        stmt = stmt.where(
            Payment.payment_date >= start_date
        )

    if end_date is not None:
        stmt = stmt.where(
            Payment.payment_date <= end_date
        )

    # -----------------------------------
    # EXECUTE AGGREGATION
    # -----------------------------------

    row = db.execute(stmt).one()

    payment_count = int(row[0] or 0)
    total_amount = float(row[1] or 0)

    return {
        "payment_count": payment_count,
        "total_amount": total_amount,
        "start_date": (
            start_date.isoformat()
            if start_date is not None
            else None
        ),
        "end_date": (
            end_date.isoformat()
            if end_date is not None
            else None
        ),
    }

def get_task_summary(
    db: Session,
    company_id: UUID,
    filters: TaskSummaryFilters,
):
    stmt = (
        select(Task)
        .join(
            ConstructionStage,
            Task.stage_id == ConstructionStage.id,
        )
        .join(
            Project,
            ConstructionStage.project_id == Project.id,
        )
        .where(
            Project.company_id == company_id
        )
    )

    if filters.project_name:
        stmt = stmt.where(
            Project.name.ilike(
                f"%{filters.project_name}%"
            )
        )

    tasks = db.scalars(stmt).all()

    today = date.today()

    total = len(tasks)

    completed = sum(
        1
        for task in tasks
        if task.status == TaskStatus.COMPLETED
    )

    in_progress = sum(
        1
        for task in tasks
        if task.status == TaskStatus.IN_PROGRESS
    )

    not_started = sum(
        1
        for task in tasks
        if task.status == TaskStatus.NOT_STARTED
    )

    overdue = sum(
        1
        for task in tasks
        if (
            task.due_date is not None
            and task.due_date < today
            and task.status != TaskStatus.COMPLETED
        )
    )

    return {
        "total_tasks": total,
        "completed": completed,
        "in_progress": in_progress,
        "not_started": not_started,
        "overdue": overdue,
    }


def get_apartment_summary(
    db: Session,
    company_id: UUID,
    filters: ApartmentSummaryFilters,
):
    stmt = (
        select(Apartment)
        .join(
            Floor,
            Apartment.floor_id == Floor.id,
        )
        .join(
            Building,
            Floor.building_id == Building.id,
        )
        .join(
            Project,
            Building.project_id == Project.id,
        )
        .where(
            Project.company_id == company_id
        )
    )

    if filters.project_name:
        stmt = stmt.where(
            Project.name.ilike(
                f"%{filters.project_name}%"
            )
        )

    apartments = db.scalars(stmt).all()

    total = len(apartments)

    available = sum(
        1
        for apartment in apartments
        if apartment.status == "available"
    )

    reserved = sum(
        1
        for apartment in apartments
        if apartment.status == "reserved"
    )

    sold = sum(
        1
        for apartment in apartments
        if apartment.status == "sold"
    )

    return {
        "total_apartments": total,
        "available": available,
        "reserved": reserved,
        "sold": sold,
    }



def get_project_report(
    db: Session,
    company_id: UUID,
    filters: ProjectReportFilters,
):
    """
    Build a complete management report for one project.

    Includes:
    - project details
    - construction stage summary
    - task summary
    - apartment inventory
    - financial summary

    Everything is scoped to the supplied company_id.
    """

    # -----------------------------------
    # PROJECT
    # -----------------------------------

    project = db.scalar(
        select(Project).where(
            Project.company_id == company_id,
            Project.name.ilike(
                f"%{filters.project_name}%"
            ),
        )
    )

    if project is None:
        return None

    # -----------------------------------
    # CONSTRUCTION STAGES
    # -----------------------------------

    stages = db.scalars(
        select(ConstructionStage).where(
            ConstructionStage.project_id == project.id
        )
    ).all()

    total_stages = len(stages)

    completed_stages = sum(
        1
        for stage in stages
        if stage.status
        == ConstructionStageStatus.COMPLETED
    )

    in_progress_stages = sum(
        1
        for stage in stages
        if stage.status
        == ConstructionStageStatus.IN_PROGRESS
    )

    not_started_stages = sum(
        1
        for stage in stages
        if stage.status
        == ConstructionStageStatus.NOT_STARTED
    )

    # -----------------------------------
    # TASKS
    # -----------------------------------

    tasks = db.scalars(
        select(Task)
        .join(
            ConstructionStage,
            Task.stage_id == ConstructionStage.id,
        )
        .where(
            ConstructionStage.project_id == project.id
        )
    ).all()

    today = date.today()

    total_tasks = len(tasks)

    completed_tasks = sum(
        1
        for task in tasks
        if task.status == TaskStatus.COMPLETED
    )

    in_progress_tasks = sum(
        1
        for task in tasks
        if task.status == TaskStatus.IN_PROGRESS
    )

    not_started_tasks = sum(
        1
        for task in tasks
        if task.status == TaskStatus.NOT_STARTED
    )

    overdue_tasks = sum(
        1
        for task in tasks
        if (
            task.due_date is not None
            and task.due_date < today
            and task.status != TaskStatus.COMPLETED
        )
    )

    # -----------------------------------
    # APARTMENTS
    # -----------------------------------

    apartments = db.scalars(
        select(Apartment)
        .join(
            Floor,
            Apartment.floor_id == Floor.id,
        )
        .join(
            Building,
            Floor.building_id == Building.id,
        )
        .where(
            Building.project_id == project.id
        )
    ).all()

    total_apartments = len(apartments)

    available_apartments = sum(
        1
        for apartment in apartments
        if apartment.status == "available"
    )

    reserved_apartments = sum(
        1
        for apartment in apartments
        if apartment.status == "reserved"
    )

    sold_apartments = sum(
        1
        for apartment in apartments
        if apartment.status == "sold"
    )

    # -----------------------------------
    # PAYMENTS / FINANCE
    # -----------------------------------

    total_spent = db.scalar(
        select(
            func.coalesce(
                func.sum(Payment.amount),
                0,
            )
        ).where(
            Payment.project_id == project.id
        )
    )

    budget = project.budget

    remaining_budget = (
        budget - total_spent
        if budget is not None
        else None
    )

    # -----------------------------------
    # RESULT
    # -----------------------------------

    return {
        "project": {
            "id": str(project.id),
            "name": project.name,
            "description": project.description,
            "location": project.location,
            "status": project.status.value,
            "progress_percent": project.progress_percent,
            "start_date": (
                project.start_date.isoformat()
                if project.start_date
                else None
            ),
            "expected_end_date": (
                project.expected_end_date.isoformat()
                if project.expected_end_date
                else None
            ),
        },

        "stages": {
            "total": total_stages,
            "completed": completed_stages,
            "in_progress": in_progress_stages,
            "not_started": not_started_stages,
        },

        "tasks": {
            "total": total_tasks,
            "completed": completed_tasks,
            "in_progress": in_progress_tasks,
            "not_started": not_started_tasks,
            "overdue": overdue_tasks,
        },

        "apartments": {
            "total": total_apartments,
            "available": available_apartments,
            "reserved": reserved_apartments,
            "sold": sold_apartments,
        },

        "finance": {
            "budget": (
                float(budget)
                if budget is not None
                else None
            ),
            "total_spent": float(total_spent),
            "remaining_budget": (
                float(remaining_budget)
                if remaining_budget is not None
                else None
            ),
        },
    }