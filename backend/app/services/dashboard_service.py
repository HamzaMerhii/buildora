from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.project import Project, ProjectStatus
from app.models.payment import Payment
from app.models.lead import Lead, LeadStatus
from app.models.apartment import Apartment, ApartmentStatus
from app.models.floor import Floor
from app.models.building import Building
from app.models.party import Party
from app.models.payment_category import PaymentCategory


def get_company_dashboard_summary(
    company_id: UUID,
    db: Session,
):
    # ---------------------------------------------------------
    # Verify company
    # ---------------------------------------------------------

    company = db.scalar(
        select(Company).where(
            Company.id == company_id
        )
    )

    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )

    # ---------------------------------------------------------
    # Get company projects
    # ---------------------------------------------------------

    projects = db.scalars(
        select(Project)
        .where(
            Project.company_id == company_id
        )
        .order_by(
            Project.created_at.desc()
        )
    ).all()

    # ---------------------------------------------------------
    # Project counts
    # ---------------------------------------------------------

    project_counts = {
        "total": len(projects),
        "planning": 0,
        "in_progress": 0,
        "completed": 0,
        "on_hold": 0,
    }

    for project in projects:
        if project.status == ProjectStatus.PLANNING:
            project_counts["planning"] += 1

        elif project.status == ProjectStatus.IN_PROGRESS:
            project_counts["in_progress"] += 1

        elif project.status == ProjectStatus.COMPLETED:
            project_counts["completed"] += 1

        elif project.status == ProjectStatus.ON_HOLD:
            project_counts["on_hold"] += 1

    # ---------------------------------------------------------
    # Total budget
    # ---------------------------------------------------------

    total_budget = sum(
        (
            Decimal(str(project.budget or 0))
            for project in projects
        ),
        Decimal("0"),
    )

    # ---------------------------------------------------------
    # Payments grouped by project
    # ---------------------------------------------------------

    payment_rows = db.execute(
        select(
            Payment.project_id,
            func.coalesce(
                func.sum(Payment.amount),
                0,
            ).label("paid"),
        )
        .join(
            Project,
            Payment.project_id == Project.id,
        )
        .where(
            Project.company_id == company_id
        )
        .group_by(
            Payment.project_id
        )
    ).all()

    paid_by_project = {
        project_id: Decimal(str(paid))
        for project_id, paid in payment_rows
    }

    total_paid = sum(
        paid_by_project.values(),
        Decimal("0"),
    )

    remaining_budget = total_budget - total_paid

    # Avoid division by zero
    if total_budget > 0:
        budget_utilization_percent = round(
            float(
                (total_paid / total_budget) * 100
            ),
            2,
        )
    else:
        budget_utilization_percent = 0

    # ---------------------------------------------------------
    # Projects summary
    # ---------------------------------------------------------

    projects_response = []

    for project in projects:
        budget = Decimal(
            str(project.budget or 0)
        )

        paid = paid_by_project.get(
            project.id,
            Decimal("0"),
        )

        remaining = budget - paid

        projects_response.append(
            {
                "project_id": project.id,
                "name": project.name,
                "budget": budget,
                "paid": paid,
                "remaining": remaining,
                "progress_percent": (
                    project.progress_percent or 0
                ),
            }
        )

    # ---------------------------------------------------------
    # Open leads
    #
    # Lead -> Apartment -> Floor -> Building -> Project
    # ---------------------------------------------------------

    open_leads = db.scalar(
        select(
            func.count(Lead.id)
        )
        .join(
            Apartment,
            Lead.apartment_id == Apartment.id,
        )
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
            Project.company_id == company_id,
            Lead.status.in_(
                [
                    LeadStatus.NEW,
                    LeadStatus.CONTACTED,
                ]
            ),
        )
    ) or 0

    # ---------------------------------------------------------
    # Recent payments
    # ---------------------------------------------------------

    recent_payments = db.scalars(
        select(Payment)
        .join(
            Project,
            Payment.project_id == Project.id,
        )
        .where(
            Project.company_id == company_id
        )
        .order_by(
            Payment.payment_date.desc(),
            Payment.created_at.desc(),
        )
        .limit(5)
    ).all()

    # ---------------------------------------------------------
    # Response
    # ---------------------------------------------------------

    return {
        "project_counts": project_counts,

        "total_budget": total_budget,
        "total_paid": total_paid,
        "remaining_budget": remaining_budget,
        "budget_utilization_percent": (
            budget_utilization_percent
        ),

        "open_leads": open_leads,

        "projects": projects_response,

        "recent_payments": recent_payments,
    }


from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.project import Project
from app.models.construction_stage import ConstructionStage
from app.models.task import Task


def get_company_tasks(
    company_id: UUID,
    db: Session,
):
    company = db.scalar(
        select(Company).where(
            Company.id == company_id
        )
    )

    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )

    rows = db.execute(
        select(
            Task,
            ConstructionStage.name.label("stage_name"),
            Project.id.label("project_id"),
            Project.name.label("project_name"),
        )
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
        .order_by(
            Task.created_at.desc()
        )
    ).all()

    return [
        {
            "id": task.id,
            "title": task.title,
            "status": task.status,
            "progress_percent": task.progress_percent,
            "assigned_to": task.assigned_to,
            "start_date": task.start_date,
            "due_date": task.due_date,
            "stage_id": task.stage_id,
            "stage_name": stage_name,
            "project_id": project_id,
            "project_name": project_name,
        }
        for task, stage_name, project_id, project_name in rows
    ]


def get_company_sales_dashboard(
    company_id: UUID,
    db: Session,
):
    # Verify company exists
    company = db.scalar(
        select(Company).where(
            Company.id == company_id
        )
    )

    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )

    # ---------------------------------------------------------
    # Apartment counts
    # Apartment -> Floor -> Building -> Project -> Company
    # ---------------------------------------------------------

    apartment_rows = db.execute(
        select(
            Apartment.status,
            func.count(Apartment.id),
        )
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
        .group_by(
            Apartment.status
        )
    ).all()

    apartment_counts = {
        "total": 0,
        "available": 0,
        "reserved": 0,
        "sold": 0,
        "public": 0,
    }

    for apartment_status, count in apartment_rows:
        apartment_counts["total"] += count

        if apartment_status == ApartmentStatus.AVAILABLE:
            apartment_counts["available"] = count

        elif apartment_status == ApartmentStatus.RESERVED:
            apartment_counts["reserved"] = count

        elif apartment_status == ApartmentStatus.SOLD:
            apartment_counts["sold"] = count

    # ---------------------------------------------------------
    # Public apartments
    # ---------------------------------------------------------

    public_count = db.scalar(
        select(
            func.count(Apartment.id)
        )
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
            Project.company_id == company_id,
            Apartment.is_public.is_(True),
        )
    ) or 0

    apartment_counts["public"] = public_count

    # ---------------------------------------------------------
    # Top enquired units
    # ---------------------------------------------------------

    top_enquired_rows = db.execute(
        select(
            Apartment.id.label("apartment_id"),
            Apartment.unit_number,
            Project.id.label("project_id"),
            Project.name.label("project_name"),
            func.count(Lead.id).label("lead_count"),
        )
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
        .join(
            Lead,
            Lead.apartment_id == Apartment.id,
        )
        .where(
            Project.company_id == company_id
        )
        .group_by(
            Apartment.id,
            Apartment.unit_number,
            Project.id,
            Project.name,
        )
        .order_by(
            func.count(Lead.id).desc()
        )
        .limit(5)
    ).all()

    top_enquired_units = [
        {
            "apartment_id": apartment_id,
            "unit_number": unit_number,
            "project_id": project_id,
            "project_name": project_name,
            "lead_count": lead_count,
        }
        for (
            apartment_id,
            unit_number,
            project_id,
            project_name,
            lead_count,
        ) in top_enquired_rows
    ]

    return {
        "apartments": apartment_counts,
        "top_enquired_units": top_enquired_units,
    }


def get_company_finance_dashboard(
    company_id: UUID,
    db: Session,
):
    # ---------------------------------------------------------
    # Verify company
    # ---------------------------------------------------------

    company = db.scalar(
        select(Company).where(
            Company.id == company_id
        )
    )

    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )

    # ---------------------------------------------------------
    # Total paid
    # ---------------------------------------------------------

    total_paid = db.scalar(
        select(
            func.coalesce(
                func.sum(Payment.amount),
                0,
            )
        )
        .join(
            Project,
            Payment.project_id == Project.id,
        )
        .where(
            Project.company_id == company_id
        )
    )

    total_paid = Decimal(str(total_paid or 0))

    # ---------------------------------------------------------
    # Payment count
    # ---------------------------------------------------------

    payment_count = db.scalar(
        select(
            func.count(Payment.id)
        )
        .join(
            Project,
            Payment.project_id == Project.id,
        )
        .where(
            Project.company_id == company_id
        )
    ) or 0

    # ---------------------------------------------------------
    # Payments this month
    # ---------------------------------------------------------

    today = date.today()

    month_start = date(
        today.year,
        today.month,
        1,
    )

    if today.month == 12:
        next_month_start = date(
            today.year + 1,
            1,
            1,
        )
    else:
        next_month_start = date(
            today.year,
            today.month + 1,
            1,
        )

    payments_this_month = db.scalar(
        select(
            func.coalesce(
                func.sum(Payment.amount),
                0,
            )
        )
        .join(
            Project,
            Payment.project_id == Project.id,
        )
        .where(
            Project.company_id == company_id,
            Payment.payment_date >= month_start,
            Payment.payment_date < next_month_start,
        )
    )

    payments_this_month = Decimal(
        str(payments_this_month or 0)
    )

    # ---------------------------------------------------------
    # Projects covered
    # ---------------------------------------------------------

    projects_covered = db.scalar(
        select(
            func.count(
                func.distinct(Payment.project_id)
            )
        )
        .join(
            Project,
            Payment.project_id == Project.id,
        )
        .where(
            Project.company_id == company_id
        )
    ) or 0

    # ---------------------------------------------------------
    # Payments by project
    # ---------------------------------------------------------

    by_project_rows = db.execute(
        select(
            Project.id.label("project_id"),
            Project.name.label("project_name"),
            func.sum(Payment.amount).label("total_paid"),
        )
        .join(
            Payment,
            Payment.project_id == Project.id,
        )
        .where(
            Project.company_id == company_id
        )
        .group_by(
            Project.id,
            Project.name,
        )
        .order_by(
            func.sum(Payment.amount).desc()
        )
    ).all()

    by_project = [
        {
            "project_id": project_id,
            "project_name": project_name,
            "total_paid": Decimal(str(project_total)),
        }
        for (
            project_id,
            project_name,
            project_total,
        ) in by_project_rows
    ]

    # ---------------------------------------------------------
    # Payments by category
    # ---------------------------------------------------------

    by_category_rows = db.execute(
        select(
            PaymentCategory.id.label("category_id"),
            PaymentCategory.name.label("category_name"),
            func.sum(Payment.amount).label("total_paid"),
        )
        .join(
            Payment,
            Payment.category_id == PaymentCategory.id,
        )
        .join(
            Project,
            Payment.project_id == Project.id,
        )
        .where(
            Project.company_id == company_id
        )
        .group_by(
            PaymentCategory.id,
            PaymentCategory.name,
        )
        .order_by(
            func.sum(Payment.amount).desc()
        )
    ).all()

    by_category = [
        {
            "category_id": category_id,
            "category_name": category_name,
            "total_paid": Decimal(str(category_total)),
        }
        for (
            category_id,
            category_name,
            category_total,
        ) in by_category_rows
    ]

    # ---------------------------------------------------------
    # Recent payments
    # ---------------------------------------------------------

    recent_payment_rows = db.execute(
        select(
            Payment.id,
            Payment.amount,
            Payment.payment_date,
            Payment.reference,
            Payment.description,

            Project.id.label("project_id"),
            Project.name.label("project_name"),

            Party.id.label("party_id"),
            Party.name.label("party_name"),

            PaymentCategory.id.label("category_id"),
            PaymentCategory.name.label("category_name"),
        )
        .join(
            Project,
            Payment.project_id == Project.id,
        )
        .outerjoin(
            Party,
            Payment.party_id == Party.id,
        )
        .outerjoin(
            PaymentCategory,
            Payment.category_id == PaymentCategory.id,
        )
        .where(
            Project.company_id == company_id
        )
        .order_by(
            Payment.payment_date.desc(),
            Payment.created_at.desc(),
        )
        .limit(10)
    ).all()

    recent_payments = [
        {
            "id": payment_id,

            "project_id": project_id,
            "project_name": project_name,

            "party_id": party_id,
            "party_name": party_name,

            "category_id": category_id,
            "category_name": category_name,

            "amount": Decimal(str(amount)),
            "payment_date": payment_date,

            "reference": reference,
            "description": description,
        }
        for (
            payment_id,
            amount,
            payment_date,
            reference,
            description,
            project_id,
            project_name,
            party_id,
            party_name,
            category_id,
            category_name,
        ) in recent_payment_rows
    ]

    return {
        "total_paid": total_paid,
        "payment_count": payment_count,
        "payments_this_month": payments_this_month,
        "projects_covered": projects_covered,

        "by_project": by_project,
        "by_category": by_category,
        "recent_payments": recent_payments,
    }