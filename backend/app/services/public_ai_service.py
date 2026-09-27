import logging

from sqlalchemy.orm import Session

from app.schemas.public_ai import (
    PublicAIIntent,
    PublicAISearchResponse,
    PublicApartmentSearchFilters,
)

from app.services.public_ai_parser_service import (
    parse_public_ai_query,
)

from app.services.public_ai_query_service import (
    search_public_apartments,
)


logger = logging.getLogger(__name__)


# -----------------------------------
# EXCEPTIONS
# -----------------------------------

class PublicAIServiceError(Exception):
    pass


class UnsupportedPublicAIQueryError(
    PublicAIServiceError
):
    pass


class PublicAIQueryExecutionError(
    PublicAIServiceError
):
    pass


# -----------------------------------
# EXECUTE PUBLIC AI SEARCH
# -----------------------------------

def execute_public_ai_search(
    *,
    db: Session,
    query: str,
) -> PublicAISearchResponse:

    cleaned_query = query.strip()

    if not cleaned_query:
        raise PublicAIServiceError(
            "Query cannot be empty."
        )

    # -----------------------------------
    # PARSE
    # -----------------------------------

    parsed = parse_public_ai_query(
        cleaned_query
    )

    # -----------------------------------
    # UNKNOWN
    # -----------------------------------

    if parsed.intent == PublicAIIntent.UNKNOWN:

        return PublicAISearchResponse(
            query=cleaned_query,
            intent=parsed.intent,
            filters=None,
            answer=(
                "I can help you find apartments by "
                "location, company, project, price, "
                "bedrooms, bathrooms, and area."
            ),
            count=0,
            results=[],
        )

    # -----------------------------------
    # APARTMENT_SEARCH
    # -----------------------------------

    if (
        parsed.intent
        == PublicAIIntent.APARTMENT_SEARCH
    ):

        filters = parsed.filters

        if not isinstance(
            filters,
            PublicApartmentSearchFilters,
        ):
            raise PublicAIQueryExecutionError(
                "Invalid apartment search filters."
            )

        # -----------------------------------
        # FILTER VALIDATION
        # -----------------------------------

        if (
            filters.min_price is not None
            and filters.max_price is not None
            and filters.min_price
            > filters.max_price
        ):
            raise PublicAIQueryExecutionError(
                "Minimum price cannot be greater "
                "than maximum price."
            )

        if (
            filters.min_area is not None
            and filters.max_area is not None
            and filters.min_area
            > filters.max_area
        ):
            raise PublicAIQueryExecutionError(
                "Minimum area cannot be greater "
                "than maximum area."
            )

        # -----------------------------------
        # DATABASE SEARCH
        # -----------------------------------

        results = search_public_apartments(
            db=db,
            filters=filters,
        )

        count = len(
            results
        )

        # -----------------------------------
        # ANSWER
        # -----------------------------------

        if count == 0:

            answer = (
                "I couldn't find any available "
                "apartments matching your request."
            )

        elif count == 1:

            answer = (
                "I found 1 available apartment "
                "matching your request."
            )

        else:

            answer = (
                f"I found {count} available apartments "
                f"matching your request."
            )

        logger.info(
            "Public AI apartment search completed",
            extra={
                "query": cleaned_query,
                "count": count,
            },
        )

        return PublicAISearchResponse(
            query=cleaned_query,
            intent=parsed.intent,
            filters=filters,
            answer=answer,
            count=count,
            results=results,
        )

    # -----------------------------------
    # FALLBACK
    # -----------------------------------

    raise UnsupportedPublicAIQueryError(
        f"{parsed.intent.value} is not implemented."
    )