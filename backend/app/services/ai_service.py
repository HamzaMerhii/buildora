import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dependencies.permissions import (
    require_company_member,
    require_finance,
    require_site_management,
    require_project_manager,
)
from app.models import CompanyMembership, User
from app.schemas.ai import (
    AIIntent,
    AISearchResponse,
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
from app.services.ai_parser_service import (
    AIParserError,
    parse_ai_query,
)
from app.services.ai_query_service import (
    get_apartment_summary,
    get_payment_summary,
    get_project_financial_summary,
    get_project_progress_summary,
    get_project_report,
    get_task_summary,
    search_apartments,
    search_payments,
    search_projects,
    search_tasks,
)


logger = logging.getLogger(__name__)


class AIServiceError(Exception):
    """Base AI service exception."""


class UnsupportedAIQueryError(AIServiceError):
    """Raised when an intent is unsupported or not implemented."""


class AIQueryExecutionError(AIServiceError):
    """Raised when an approved AI query cannot be executed safely."""

class AIIntentPermissionError(AIServiceError):
    """Raised when the user's company role cannot access an AI intent."""


def execute_ai_search(
    *,
    db: Session,
    company_id: UUID,
    query: str,
    current_user: User,
) -> AISearchResponse:
    """
    Execute a read-only Buildora AI search.

    Flow:
    1. Validate query
    2. Parse intent and filters with Gemini
    3. Check current user's company membership
    4. Check intent permission using existing Buildora permissions
    5. Execute approved SQLAlchemy query
    6. Return real database results
    """

    cleaned_query = query.strip()

    if not cleaned_query:
        raise ValueError(
            "AI search query cannot be empty."
        )

    logger.info(
        "Starting AI search",
        extra={
            "company_id": str(company_id),
            "query": cleaned_query,
        },
    )

    try:
        parsed = parse_ai_query(
            cleaned_query
        )

    except AIParserError:
        logger.exception(
            "AI parser failed",
            extra={
                "company_id": str(company_id),
            },
        )
        raise

    logger.info(
        "AI query parsed",
        extra={
            "company_id": str(company_id),
            "intent": parsed.intent.value,
        },
    )

    # -----------------------------------
    # UNKNOWN
    # -----------------------------------

    if parsed.intent == AIIntent.UNKNOWN:
        raise UnsupportedAIQueryError(
            "This question is not supported by Buildora AI search."
        )

    # -----------------------------------
    # GET ACTIVE MEMBERSHIP
    # -----------------------------------

    membership = db.scalar(
        select(CompanyMembership).where(
            CompanyMembership.user_id == current_user.id,
            CompanyMembership.company_id == company_id,
            CompanyMembership.is_active.is_(True),
        )
    )

    if membership is None:
        raise AIIntentPermissionError(
            "You are not an active member of this company."
        )

    # -----------------------------------
    # SEARCH_TASKS
    # -----------------------------------

    if parsed.intent == AIIntent.SEARCH_TASKS:

        if membership.role not in require_site_management.allowed_roles:
            raise AIIntentPermissionError(
                "Your company role cannot search tasks."
            )

        filters = parsed.filters

        if not isinstance(filters, TaskFilters):
            raise AIQueryExecutionError(
                "Invalid task filters."
            )

        results = search_tasks(
            db=db,
            company_id=company_id,
            filters=filters,
        )

        serialized_results = [
            {
                "id": str(task.id),
                "title": task.title,
                "description": task.description,
                "status": task.status.value,
                "progress_percent": task.progress_percent,
                "start_date": (
                    task.start_date.isoformat()
                    if task.start_date
                    else None
                ),
                "due_date": (
                    task.due_date.isoformat()
                    if task.due_date
                    else None
                ),
                "assigned_to": (
                    str(task.assigned_to)
                    if task.assigned_to
                    else None
                ),
                "stage_id": str(task.stage_id),
            }
            for task in results
        ]

        count = len(serialized_results)

        if count == 0:
            answer = "No matching tasks were found."

        elif filters.overdue is True:
            answer = (
                f"I found {count} overdue "
                f"task{'s' if count != 1 else ''}."
            )

        else:
            answer = (
                f"I found {count} matching "
                f"task{'s' if count != 1 else ''}."
            )

        logger.info(
            "AI task search completed",
            extra={
                "company_id": str(company_id),
                "result_count": count,
            },
        )

        return AISearchResponse(
            query=cleaned_query,
            intent=parsed.intent,
            filters=filters,
            answer=answer,
            count=count,
            results=serialized_results,
        )

    # -----------------------------------
    # SEARCH_PROJECTS
    # -----------------------------------

    if parsed.intent == AIIntent.SEARCH_PROJECTS:

        if membership.role not in require_site_management.allowed_roles:
            raise AIIntentPermissionError(
                "Your company role cannot search projects."
            )

        filters = parsed.filters

        if not isinstance(filters, ProjectFilters):
            raise AIQueryExecutionError(
                "Invalid project filters."
            )

        results = search_projects(
            db=db,
            company_id=company_id,
            filters=filters,
        )

        serialized_results = [
            {
                "id": str(project.id),
                "name": project.name,
                "description": project.description,
                "location": project.location,
                "status": project.status.value,
                "budget": (
                    float(project.budget)
                    if project.budget is not None
                    else None
                ),
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
            for project in results
        ]

        count = len(serialized_results)

        if count == 0:
            answer = "No matching projects were found."

        else:
            answer = (
                f"I found {count} matching "
                f"project{'s' if count != 1 else ''}."
            )

        logger.info(
            "AI project search completed",
            extra={
                "company_id": str(company_id),
                "result_count": count,
            },
        )

        return AISearchResponse(
            query=cleaned_query,
            intent=parsed.intent,
            filters=filters,
            answer=answer,
            count=count,
            results=serialized_results,
        )

    # -----------------------------------
    # SEARCH_APARTMENTS
    # -----------------------------------

    if parsed.intent == AIIntent.SEARCH_APARTMENTS:

        if membership.role not in require_project_manager.allowed_roles:
            raise AIIntentPermissionError(
                "Your company role cannot search apartments."
            )

        filters = parsed.filters

        if not isinstance(filters, ApartmentFilters):
            raise AIQueryExecutionError(
                "Invalid apartment filters."
            )

        results = search_apartments(
            db=db,
            company_id=company_id,
            filters=filters,
        )

        serialized_results = [
            {
                "id": str(apartment.id),
                "unit_number": apartment.unit_number,
                "area_sqm": (
                    float(apartment.area_sqm)
                    if apartment.area_sqm is not None
                    else None
                ),
                "bedrooms": apartment.bedrooms,
                "bathrooms": apartment.bathrooms,
                "price": (
                    float(apartment.price)
                    if apartment.price is not None
                    else None
                ),
                "status": apartment.status,
                "is_public": apartment.is_public,
                "description": apartment.description,
                "floor_id": str(apartment.floor_id),
            }
            for apartment in results
        ]

        count = len(serialized_results)

        if count == 0:
            answer = "No matching apartments were found."

        else:
            answer = (
                f"I found {count} matching "
                f"apartment{'s' if count != 1 else ''}."
            )

        logger.info(
            "AI apartment search completed",
            extra={
                "company_id": str(company_id),
                "result_count": count,
            },
        )

        return AISearchResponse(
            query=cleaned_query,
            intent=parsed.intent,
            filters=filters,
            answer=answer,
            count=count,
            results=serialized_results,
        )

    # -----------------------------------
    # SEARCH_PAYMENTS
    # -----------------------------------

    if parsed.intent == AIIntent.SEARCH_PAYMENTS:

        if membership.role not in require_finance.allowed_roles:
            raise AIIntentPermissionError(
                "Your company role cannot search payments."
            )

        filters = parsed.filters

        if not isinstance(filters, PaymentFilters):
            raise AIQueryExecutionError(
                "Invalid payment filters."
            )

        results = search_payments(
            db=db,
            company_id=company_id,
            filters=filters,
        )

        serialized_results = [
            {
                "id": str(payment.id),
                "project_id": str(payment.project_id),
                "party_id": str(payment.party_id),
                "category_id": str(payment.category_id),
                "amount": float(payment.amount),
                "payment_date": payment.payment_date.isoformat(),
                "description": payment.description,
                "reference": payment.reference,
            }
            for payment in results
        ]

        count = len(serialized_results)

        total_amount = sum(
            float(payment.amount)
            for payment in results
        )

        if count == 0:
            answer = "No matching payments were found."

        elif filters.party_name:
            answer = (
                f"I found {count} payment"
                f"{'s' if count != 1 else ''} "
                f"for {filters.party_name}, "
                f"with a total of {total_amount:.2f}."
            )

        else:
            answer = (
                f"I found {count} matching payment"
                f"{'s' if count != 1 else ''}, "
                f"with a total of {total_amount:.2f}."
            )

        logger.info(
            "AI payment search completed",
            extra={
                "company_id": str(company_id),
                "result_count": count,
            },
        )

        return AISearchResponse(
            query=cleaned_query,
            intent=parsed.intent,
            filters=filters,
            answer=answer,
            count=count,
            results=serialized_results,
        )
# -----------------------------------
# PROJECT_FINANCIAL_SUMMARY
# -----------------------------------

    if parsed.intent == AIIntent.PROJECT_FINANCIAL_SUMMARY:

        if membership.role not in require_finance.allowed_roles:
            raise AIIntentPermissionError(
            "Your company role cannot access project financial information."
        )

        filters = parsed.filters

        if not isinstance(
            filters,
            ProjectFinancialFilters,
        ):
            raise AIQueryExecutionError(
                "Invalid project financial filters."
            )

        result = get_project_financial_summary(
            db=db,
            company_id=company_id,
            filters=filters,
        )

        if result is None:
            return AISearchResponse(
                query=cleaned_query,
                intent=parsed.intent,
                filters=filters,
                answer=(
                    f"No project matching "
                    f"'{filters.project_name}' was found."
                ),
                count=0,
                results=[],
            )

        budget = result["budget"]
        total_spent = result["total_spent"]
        remaining_budget = result["remaining_budget"]

        if remaining_budget is None:
            answer = (
                f"{result['project_name']} does not have "
                "a budget configured. "
                f"Total recorded spending is {total_spent:.2f}."
            )

        else:
            answer = (
                f"{result['project_name']} has a budget of "
                f"{budget:.2f}, total spending of "
                f"{total_spent:.2f}, and a remaining "
                f"budget of {remaining_budget:.2f}."
            )

        logger.info(
            "AI project financial summary completed",
            extra={
                "company_id": str(company_id),
                "project_id": result["project_id"],
            },
        )

        return AISearchResponse(
            query=cleaned_query,
        intent=parsed.intent,
        filters=filters,
        answer=answer,
        count=1,
        results=[result],
    )
        # -----------------------------------
    # PROJECT_PROGRESS_SUMMARY
    # -----------------------------------

    if parsed.intent == AIIntent.PROJECT_PROGRESS_SUMMARY:

        if membership.role not in require_site_management.allowed_roles:
            raise AIIntentPermissionError(
                "Your company role cannot access project progress."
            )

        filters = parsed.filters

        if not isinstance(
            filters,
            ProjectProgressFilters,
        ):
            raise AIQueryExecutionError(
                "Invalid project progress filters."
            )

        result = get_project_progress_summary(
            db=db,
            company_id=company_id,
            filters=filters,
        )

        if result is None:
            return AISearchResponse(
                query=cleaned_query,
                intent=parsed.intent,
                filters=filters,
                answer=(
                    f"No project matching "
                    f"'{filters.project_name}' was found."
                ),
                count=0,
                results=[],
            )

        answer = (
            f"{result['project_name']} is currently "
            f"{result['progress_percent']}% complete "
            f"with status {result['status']}."
        )

        logger.info(
            "AI project progress summary completed",
            extra={
                "company_id": str(company_id),
                "project_id": result["project_id"],
            },
        )

        return AISearchResponse(
            query=cleaned_query,
            intent=parsed.intent,
            filters=filters,
            answer=answer,
            count=1,
            results=[result],
        )

        # -----------------------------------
    
        # -----------------------------------
    # TASK_SUMMARY
    # -----------------------------------

    if parsed.intent == AIIntent.TASK_SUMMARY:

        if membership.role not in require_site_management.allowed_roles:
            raise AIIntentPermissionError(
                "Your company role cannot access task summaries."
            )

        filters = parsed.filters

        if not isinstance(
            filters,
            TaskSummaryFilters,
        ):
            raise AIQueryExecutionError(
                "Invalid task summary filters."
            )

        result = get_task_summary(
            db=db,
            company_id=company_id,
            filters=filters,
        )

        total = result["total_tasks"]

        if total == 0:
            if filters.project_name:
                answer = (
                    f"No tasks were found for "
                    f"{filters.project_name}."
                )
            else:
                answer = (
                    "No tasks were found."
                )

        else:
            if filters.project_name:
                prefix = (
                    f"{filters.project_name} has "
                )
            else:
                prefix = (
                    "The company has "
                )

            answer = (
                f"{prefix}{total} task"
                f"{'s' if total != 1 else ''}: "
                f"{result['completed']} completed, "
                f"{result['in_progress']} in progress, "
                f"{result['not_started']} not started, "
                f"and {result['overdue']} overdue."
            )

        logger.info(
            "AI task summary completed",
            extra={
                "company_id": str(company_id),
                "project_name": filters.project_name,
                "task_count": total,
            },
        )

        return AISearchResponse(
            query=cleaned_query,
            intent=parsed.intent,
            filters=filters,
            answer=answer,
            count=total,
            results=[result],
        )
    
    # PAYMENT_SUMMARY
    # -----------------------------------

    if parsed.intent == AIIntent.PAYMENT_SUMMARY:

        if membership.role not in require_finance.allowed_roles:
            raise AIIntentPermissionError(
                "Your company role cannot access payment summaries."
            )

        filters = parsed.filters

        if not isinstance(
            filters,
            PaymentSummaryFilters,
        ):
            raise AIQueryExecutionError(
                "Invalid payment summary filters."
            )

        result = get_payment_summary(
            db=db,
            company_id=company_id,
            filters=filters,
        )

        count = result["payment_count"]
        total_amount = result["total_amount"]

        if count == 0:
            answer = "No matching payments were found."
        else:
            answer = (
                f"I found {count} matching payment"
                f"{'s' if count != 1 else ''} "
                f"with a total amount of {total_amount:.2f}."
            )

        return AISearchResponse(
            query=cleaned_query,
            intent=parsed.intent,
            filters=filters,
            answer=answer,
            count=count,
            results=[result],
        )

       # -----------------------------------
    # APARTMENT_SUMMARY
    # -----------------------------------

    if parsed.intent == AIIntent.APARTMENT_SUMMARY:

        if membership.role not in require_project_manager.allowed_roles:
            raise AIIntentPermissionError(
                "Your company role cannot access apartment summaries."
            )

        filters = parsed.filters

        if not isinstance(
            filters,
            ApartmentSummaryFilters,
        ):
            raise AIQueryExecutionError(
                "Invalid apartment summary filters."
            )

        result = get_apartment_summary(
            db=db,
            company_id=company_id,
            filters=filters,
        )

        total = result["total_apartments"]

        if total == 0:
            answer = "No apartments were found."
        else:
            answer = (
                f"I found {total} apartments: "
                f"{result['available']} available, "
                f"{result['reserved']} reserved, "
                f"and {result['sold']} sold."
            )

        logger.info(
            "AI apartment summary completed",
            extra={
                "company_id": str(company_id),
                "apartment_count": total,
            },
        )

        return AISearchResponse(
            query=cleaned_query,
            intent=parsed.intent,
            filters=filters,
            answer=answer,
            count=total,
            results=[result],
        )

    # -----------------------------------
    # PROJECT_REPORT
    # -----------------------------------
    if parsed.intent == AIIntent.PROJECT_REPORT:

        if membership.role not in require_project_manager.allowed_roles:
            raise AIIntentPermissionError(
                "Your company role cannot access full project reports."
            )

        filters = parsed.filters

        if not isinstance(
            filters,
            ProjectReportFilters,
        ):
            raise AIQueryExecutionError(
                "Invalid project report filters."
            )

        result = get_project_report(
            db=db,
            company_id=company_id,
            filters=filters,
        )

        if result is None:
            return AISearchResponse(
                query=cleaned_query,
                intent=parsed.intent,
                filters=filters,
                answer=(
                    f"No project matching "
                    f"'{filters.project_name}' was found."
                ),
                count=0,
                results=[],
            )

        project = result["project"]
        stages = result["stages"]
        tasks = result["tasks"]
        apartments = result["apartments"]
        finance = result["finance"]

        # -----------------------------------
        # BUILD READABLE REPORT
        # -----------------------------------

        answer_parts = []

        answer_parts.append(
            f"{project['name']} is currently "
            f"{project['status'].replace('_', ' ')} "
            f"and is {project['progress_percent']}% complete."
        )

        if project["location"]:
            answer_parts.append(
                f"The project is located in {project['location']}."
            )

        if project["start_date"] or project["expected_end_date"]:
            date_text = "The project"

            if project["start_date"]:
                date_text += (
                    f" started on {project['start_date']}"
                )

            if project["expected_end_date"]:
                date_text += (
                    f" and is expected to finish on "
                    f"{project['expected_end_date']}"
                )

            answer_parts.append(
                date_text + "."
            )

        answer_parts.append(
            f"It has {stages['total']} construction stage"
            f"{'s' if stages['total'] != 1 else ''}: "
            f"{stages['completed']} completed, "
            f"{stages['in_progress']} in progress, "
            f"and {stages['not_started']} not started."
        )

        answer_parts.append(
            f"There are {tasks['total']} task"
            f"{'s' if tasks['total'] != 1 else ''}: "
            f"{tasks['completed']} completed, "
            f"{tasks['in_progress']} in progress, "
            f"{tasks['not_started']} not started, "
            f"with {tasks['overdue']} overdue."
        )

        answer_parts.append(
            f"The project contains {apartments['total']} apartment"
            f"{'s' if apartments['total'] != 1 else ''}: "
            f"{apartments['available']} available, "
            f"{apartments['reserved']} reserved, "
            f"and {apartments['sold']} sold."
        )

        if finance["budget"] is None:
            answer_parts.append(
                f"No project budget is configured. "
                f"Recorded spending is "
                f"{finance['total_spent']:.2f}."
            )

        else:
            answer_parts.append(
                f"The total budget is "
                f"{finance['budget']:.2f}, "
                f"recorded spending is "
                f"{finance['total_spent']:.2f}, "
                f"and the remaining budget is "
                f"{finance['remaining_budget']:.2f}."
            )

        answer = " ".join(
            answer_parts
        )

        logger.info(
            "AI project report completed",
            extra={
                "company_id": str(company_id),
                "project_id": project["id"],
                "project_name": project["name"],
            },
        )

        return AISearchResponse(
            query=cleaned_query,
            intent=parsed.intent,
            filters=filters,
            answer=answer,
            count=1,
            results=[result],
        )
    
    # -----------------------------------
    # FALLBACK
    # -----------------------------------
    raise UnsupportedAIQueryError(
        f"{parsed.intent.value} is not implemented yet."
    )