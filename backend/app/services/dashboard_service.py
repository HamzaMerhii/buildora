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
from app.models.user import User
from app.models.company import Company
from app.models.construction_stage import ConstructionStage
from app.models.task import Task
from app.models.apartment_image import ApartmentImage

def get_company_dashboard_summary(
    company_id: UUID,
    db: Session,
):
    # No separate company lookup: the route guard (require_company_owner)
    # already proves an active membership in this company, so a missing
    # company cannot reach this service (guard returns 403 first).

    # =========================================================
    # 2. Payment totals grouped by project
    #
    # Used as a subquery so project cards + total paid
    # don't require another DB round trip.
    # =========================================================

    payment_by_project_subquery = (
        select(
            Payment.project_id.label("project_id"),
            func.coalesce(
                func.sum(Payment.amount),
                0,
            ).label("paid"),
        )
        .group_by(
            Payment.project_id
        )
        .subquery()
    )

    # =========================================================
    # 3. Current stage
    #
    # Same business logic as before:
    # first stage by order_index where progress < 100.
    # =========================================================

    current_stage_subquery = (
        select(
            ConstructionStage.name
        )
        .where(
            ConstructionStage.project_id == Project.id,
            ConstructionStage.progress_percent < 100,
        )
        .order_by(
            ConstructionStage.order_index.asc()
        )
        .limit(1)
        .correlate(Project)
        .scalar_subquery()
    )

    # =========================================================
    # 4. Projects + project counts + paid + current stage
    #
    # Replaces:
    # - project query
    # - Python project status counting
    # - payment-by-project query
    # - current-stage query
    # =========================================================

    project_rows = db.execute(
        select(
            Project,

            func.coalesce(
                payment_by_project_subquery.c.paid,
                0,
            ).label("paid"),

            current_stage_subquery.label(
                "current_stage"
            ),

            # Project counts computed in SQL
            func.count(Project.id)
            .over()
            .label("total_count"),

            func.count(Project.id)
            .filter(
                Project.status == ProjectStatus.PLANNING
            )
            .over()
            .label("planning_count"),

            func.count(Project.id)
            .filter(
                Project.status == ProjectStatus.IN_PROGRESS
            )
            .over()
            .label("in_progress_count"),

            func.count(Project.id)
            .filter(
                Project.status == ProjectStatus.COMPLETED
            )
            .over()
            .label("completed_count"),

            func.count(Project.id)
            .filter(
                Project.status == ProjectStatus.ON_HOLD
            )
            .over()
            .label("on_hold_count"),
        )
        .outerjoin(
            payment_by_project_subquery,
            payment_by_project_subquery.c.project_id
            == Project.id,
        )
        .where(
            Project.company_id == company_id
        )
        .order_by(
            Project.created_at.desc()
        )
    ).all()

    # =========================================================
    # Project counts
    # =========================================================

    if project_rows:
        first_row = project_rows[0]

        project_counts = {
            "total": first_row.total_count,
            "planning": first_row.planning_count,
            "in_progress": first_row.in_progress_count,
            "completed": first_row.completed_count,
            "on_hold": first_row.on_hold_count,
        }
    else:
        project_counts = {
            "total": 0,
            "planning": 0,
            "in_progress": 0,
            "completed": 0,
            "on_hold": 0,
        }

    # =========================================================
    # 5. Apartment total + public in ONE aggregate query
    # =========================================================

    apartment_stats = db.execute(
        select(
            func.count(
                Apartment.id
            ).label("total"),

            func.count(
                Apartment.id
            )
            .filter(
                Apartment.is_public.is_(True)
            )
            .label("public"),
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
    ).one()

    apartment_total = apartment_stats.total or 0
    apartment_public = apartment_stats.public or 0

    apartments = {
        "total": apartment_total,
        "public": apartment_public,
        "private": (
            apartment_total - apartment_public
        ),
    }

    # =========================================================
    # 6. Build project cards and budget totals
    # =========================================================

    total_budget = Decimal("0")
    total_paid = Decimal("0")

    projects_response = []

    for row in project_rows:
        project = row.Project

        budget = Decimal(
            str(project.budget or 0)
        )

        paid = Decimal(
            str(row.paid or 0)
        )

        total_budget += budget
        total_paid += paid

        projects_response.append(
            {
                "project_id": project.id,
                "name": project.name,

                "location": project.location,
                "status": project.status,
                "image": project.image,

                "budget": budget,
                "paid": paid,
                "remaining": budget - paid,

                "progress_percent": (
                    project.progress_percent or 0
                ),

                "current_stage": row.current_stage,
            }
        )

    remaining_budget = (
        total_budget - total_paid
    )

    if total_budget > 0:
        budget_utilization_percent = round(
            float(
                (total_paid / total_budget) * 100
            ),
            2,
        )
    else:
        budget_utilization_percent = 0

    # =========================================================
    # 7. Open leads
    # =========================================================

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

    # =========================================================
    # 8. Payments by category
    # =========================================================

    category_rows = db.execute(
        select(
            PaymentCategory.id,
            PaymentCategory.name,

            func.sum(
                Payment.amount
            ).label("total_paid"),
        )
        .join(
            Payment,
            Payment.category_id
            == PaymentCategory.id,
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
            func.sum(
                Payment.amount
            ).desc()
        )
    ).all()

    by_category = [
        {
            "category_id": category_id,
            "category_name": category_name,
            "total_paid": Decimal(
                str(category_total)
            ),
        }
        for (
            category_id,
            category_name,
            category_total,
        ) in category_rows
    ]

    # =========================================================
    # 9. Recent payments
    # =========================================================

    recent_payment_rows = db.execute(
        select(
            Payment.id,
            Payment.amount,
            Payment.payment_date,
            Payment.reference,
            Payment.description,

            Project.id.label(
                "project_id"
            ),
            Project.name.label(
                "project_name"
            ),

            Party.name.label(
                "party_name"
            ),

            PaymentCategory.name.label(
                "category_name"
            ),
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
            Payment.category_id
            == PaymentCategory.id,
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

    recent_payments = [
        {
            "id": payment_id,

            "project_id": project_id,
            "project_name": project_name,

            "amount": Decimal(
                str(amount)
            ),

            "payment_date": payment_date,

            "party_name": party_name,
            "category_name": category_name,
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
            party_name,
            category_name,
        ) in recent_payment_rows
    ]

    # =========================================================
    # 10. Tasks (most recent 100; the dashboard task panels read the
    # dedicated /dashboard/tasks endpoint, so the summary keeps the
    # same key with a bounded slice instead of the full collection)
    # =========================================================

    task_rows = db.execute(
        select(
            Task,

            User.name.label(
                "assigned_to_name"
            ),

            ConstructionStage.name.label(
                "stage_name"
            ),

            Project.id.label(
                "project_id"
            ),

            Project.name.label(
                "project_name"
            ),
        )
        .join(
            ConstructionStage,
            Task.stage_id == ConstructionStage.id,
        )
        .join(
            Project,
            ConstructionStage.project_id == Project.id,
        )
        .outerjoin(
            User,
            Task.assigned_to == User.id,
        )
        .where(
            Project.company_id == company_id
        )
        .order_by(
            Task.created_at.desc()
        )
        .limit(100)
    ).all()

    tasks = [
        {
            "id": task.id,
            "title": task.title,

            "status": task.status,
            "progress_percent": (
                task.progress_percent
            ),

            "assigned_to": task.assigned_to,
            "assigned_to_name": (
                assigned_to_name
            ),

            "start_date": task.start_date,
            "due_date": task.due_date,

            "stage_id": task.stage_id,
            "stage_name": stage_name,

            "project_id": project_id,
            "project_name": project_name,
        }
        for (
            task,
            assigned_to_name,
            stage_name,
            project_id,
            project_name,
        ) in task_rows
    ]

    # =========================================================
    # Final response
    # EXACT SAME CONTRACT
    # =========================================================

    return {
        "project_counts": project_counts,

        "apartments": apartments,

        "total_budget": total_budget,
        "total_paid": total_paid,
        "remaining_budget": remaining_budget,

        "budget_utilization_percent": (
            budget_utilization_percent
        ),

        "open_leads": open_leads,

        "projects": projects_response,

        "by_category": by_category,

        "recent_payments": recent_payments,

        "tasks": tasks,
    }


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
    # =========================================================
    # Verify company exists
    # =========================================================

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

    # =========================================================
    # Apartment counts by status
    # =========================================================

    apartment_status_rows = db.execute(
        select(
            Apartment.status,
            func.count(Apartment.id).label("count"),
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

    for apartment_status, count in apartment_status_rows:
        apartment_counts["total"] += count

        if apartment_status == ApartmentStatus.AVAILABLE:
            apartment_counts["available"] = count

        elif apartment_status == ApartmentStatus.RESERVED:
            apartment_counts["reserved"] = count

        elif apartment_status == ApartmentStatus.SOLD:
            apartment_counts["sold"] = count

    # =========================================================
    # Public apartments count
    # =========================================================

    public_apartment_count = db.scalar(
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

    apartment_counts["public"] = public_apartment_count

    # =========================================================
    # First uploaded image for each apartment
    # =========================================================

    first_image_subquery = (
        select(
            ApartmentImage.image_url
        )
        .where(
            ApartmentImage.apartment_id == Apartment.id
        )
        .order_by(
            ApartmentImage.created_at.asc()
        )
        .limit(1)
        .scalar_subquery()
    )

    # =========================================================
    # Top enquired apartments
    # =========================================================

    top_enquired_rows = db.execute(
        select(
            Apartment.id.label("apartment_id"),
            Apartment.unit_number,

            Apartment.is_public,
            Apartment.price,
            Apartment.bedrooms,
            Apartment.bathrooms,
            Apartment.area_sqm,

            Floor.floor_number,

            Project.id.label("project_id"),
            Project.name.label("project_name"),

            func.count(
                func.distinct(Lead.id)
            ).label("lead_count"),

            first_image_subquery.label(
                "primary_image"
            ),
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
            Apartment.is_public,
            Apartment.price,
            Apartment.bedrooms,
            Apartment.bathrooms,
            Apartment.area_sqm,

            Floor.floor_number,

            Project.id,
            Project.name,
        )
        .order_by(
            func.count(
                func.distinct(Lead.id)
            ).desc()
        )
        .limit(5)
    ).all()

    # =========================================================
    # Build response
    # =========================================================

    top_enquired_apartments = [
        {
            "apartment_id": apartment_id,
            "unit_number": unit_number,

            "project_id": project_id,
            "project_name": project_name,

            "lead_count": lead_count,

            "is_public": is_public,
            "price": price,
            "bedrooms": bedrooms,
            "bathrooms": bathrooms,
            "area_sqm": area_sqm,

            "floor_number": floor_number,

            "primary_image": primary_image,
        }
        for (
            apartment_id,
            unit_number,
            is_public,
            price,
            bedrooms,
            bathrooms,
            area_sqm,
            floor_number,
            project_id,
            project_name,
            lead_count,
            primary_image,
        ) in top_enquired_rows
    ]

    return {
        "apartments": apartment_counts,
        "top_enquired_apartments": top_enquired_apartments,
    }

def get_company_finance_dashboard(
    company_id: UUID,
    db: Session,
):
    # =========================================================
    # Verify company
    # =========================================================

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

    # =========================================================
    # Total project budget
    # =========================================================

    total_project_budget = db.scalar(
        select(
            func.coalesce(
                func.sum(Project.budget),
                0,
            )
        )
        .where(
            Project.company_id == company_id
        )
    )

    total_project_budget = Decimal(
        str(total_project_budget or 0)
    )

    # =========================================================
    # Total paid
    # =========================================================

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

    total_paid = Decimal(
        str(total_paid or 0)
    )

    remaining_balance = (
        total_project_budget - total_paid
    )

    # =========================================================
    # Payment count
    # =========================================================

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

    # =========================================================
    # Current month
    # =========================================================

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

    # =========================================================
    # Payments this month amount
    # =========================================================

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

    # =========================================================
    # Payments this month count
    # =========================================================

    payments_this_month_count = db.scalar(
        select(
            func.count(Payment.id)
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
    ) or 0

    # =========================================================
    # Projects covered by payments
    # =========================================================

    projects_covered = db.scalar(
        select(
            func.count(
                func.distinct(
                    Payment.project_id
                )
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

    # =========================================================
    # Current stage for each project
    #
    # First stage by order_index that isn't complete
    # =========================================================

    current_stage_rows = db.execute(
        select(
            ConstructionStage.project_id,
            ConstructionStage.name,
        )
        .join(
            Project,
            ConstructionStage.project_id == Project.id,
        )
        .where(
            Project.company_id == company_id,
            ConstructionStage.progress_percent < 100,
        )
        .order_by(
            ConstructionStage.project_id,
            ConstructionStage.order_index.asc(),
        )
    ).all()

    current_stage_by_project = {}

    for project_id, stage_name in current_stage_rows:
        if project_id not in current_stage_by_project:
            current_stage_by_project[
                project_id
            ] = stage_name

    # =========================================================
    # Payments by project
    # =========================================================

    by_project_rows = db.execute(
        select(
            Project.id.label("project_id"),
            Project.name.label("project_name"),
            Project.budget,

            func.coalesce(
                func.sum(Payment.amount),
                0,
            ).label("total_paid"),
        )
        .outerjoin(
            Payment,
            Payment.project_id == Project.id,
        )
        .where(
            Project.company_id == company_id
        )
        .group_by(
            Project.id,
            Project.name,
            Project.budget,
        )
        .order_by(
            func.coalesce(
                func.sum(Payment.amount),
                0,
            ).desc()
        )
    ).all()

    by_project = []

    for (
        project_id,
        project_name,
        budget,
        project_paid,
    ) in by_project_rows:

        project_budget = Decimal(
            str(budget or 0)
        )

        project_total_paid = Decimal(
            str(project_paid or 0)
        )

        by_project.append(
            {
                "project_id": project_id,
                "project_name": project_name,

                "budget": project_budget,
                "total_paid": project_total_paid,

                "remaining": (
                    project_budget
                    - project_total_paid
                ),

                "current_stage_name": (
                    current_stage_by_project.get(
                        project_id
                    )
                ),
            }
        )

    # =========================================================
    # Payments by category
    # =========================================================

    by_category_rows = db.execute(
        select(
            PaymentCategory.id.label(
                "category_id"
            ),
            PaymentCategory.name.label(
                "category_name"
            ),

            func.sum(
                Payment.amount
            ).label(
                "total_paid"
            ),
        )
        .join(
            Payment,
            Payment.category_id
            == PaymentCategory.id,
        )
        .join(
            Project,
            Payment.project_id
            == Project.id,
        )
        .where(
            Project.company_id == company_id
        )
        .group_by(
            PaymentCategory.id,
            PaymentCategory.name,
        )
        .order_by(
            func.sum(
                Payment.amount
            ).desc()
        )
    ).all()

    by_category = [
        {
            "category_id": category_id,
            "category_name": category_name,

            "total_paid": Decimal(
                str(category_total)
            ),
        }
        for (
            category_id,
            category_name,
            category_total,
        ) in by_category_rows
    ]

    # =========================================================
    # Top paid parties
    # =========================================================

    top_paid_party_rows = db.execute(
        select(
            Party.id.label(
                "party_id"
            ),
            Party.name.label(
                "party_name"
            ),

            func.sum(
                Payment.amount
            ).label(
                "total_paid"
            ),
        )
        .join(
            Payment,
            Payment.party_id == Party.id,
        )
        .join(
            Project,
            Payment.project_id == Project.id,
        )
        .where(
            Project.company_id == company_id
        )
        .group_by(
            Party.id,
            Party.name,
        )
        .order_by(
            func.sum(
                Payment.amount
            ).desc()
        )
        .limit(5)
    ).all()

    top_paid_parties = [
        {
            "party_id": party_id,
            "party_name": party_name,

            "total_paid": Decimal(
                str(party_total)
            ),
        }
        for (
            party_id,
            party_name,
            party_total,
        ) in top_paid_party_rows
    ]

    # =========================================================
    # Recent payments
    # =========================================================

    recent_payment_rows = db.execute(
        select(
            Payment.id,
            Payment.amount,
            Payment.payment_date,
            Payment.reference,
            Payment.description,

            Project.id.label(
                "project_id"
            ),
            Project.name.label(
                "project_name"
            ),

            Party.id.label(
                "party_id"
            ),
            Party.name.label(
                "party_name"
            ),

            PaymentCategory.id.label(
                "category_id"
            ),
            PaymentCategory.name.label(
                "category_name"
            ),
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
            Payment.category_id
            == PaymentCategory.id,
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

            "amount": Decimal(
                str(amount)
            ),

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

    # =========================================================
    # Final response
    # =========================================================

    return {
        "total_paid": total_paid,

        "total_project_budget": (
            total_project_budget
        ),

        "remaining_balance": (
            remaining_balance
        ),

        "payment_count": payment_count,

        "payments_this_month": (
            payments_this_month
        ),

        "payments_this_month_count": (
            payments_this_month_count
        ),

        "projects_covered": (
            projects_covered
        ),

        "by_project": by_project,

        "by_category": by_category,

        "top_paid_parties": (
            top_paid_parties
        ),

        "recent_payments": (
            recent_payments
        ),
    }