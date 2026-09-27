import logging

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from sqlalchemy.orm import Session

from app.database.db import get_db

from app.schemas.public_ai import (
    PublicAISearchRequest,
    PublicAISearchResponse,
)

from app.services.public_ai_parser_service import (
    PublicAIConfigurationError,
    PublicAIParserError,
)

from app.services.public_ai_service import (
    PublicAIQueryExecutionError,
    PublicAIServiceError,
    UnsupportedPublicAIQueryError,
    execute_public_ai_search,
)


logger = logging.getLogger(__name__)


router = APIRouter(
    prefix="/public/ai",
    tags=["Public AI"],
)


# -----------------------------------
# PUBLIC AI SEARCH
# -----------------------------------

@router.post(
    "/search",
    response_model=PublicAISearchResponse,
)
def public_ai_search(
    payload: PublicAISearchRequest,
    db: Session = Depends(get_db),
):
    try:

        return execute_public_ai_search(
            db=db,
            query=payload.query,
        )

    # -----------------------------------
    # GEMINI NOT CONFIGURED
    # -----------------------------------

    except PublicAIConfigurationError as exc:

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "PUBLIC_AI_UNAVAILABLE",
                "message": str(exc),
            },
        ) from exc

    # -----------------------------------
    # PARSER FAILURE
    # -----------------------------------

    except PublicAIParserError as exc:

        logger.exception(
            "Public AI parser failure."
        )

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "PUBLIC_AI_PARSE_ERROR",
                "message": (
                    "Unable to understand the "
                    "apartment search request."
                ),
            },
        ) from exc

    # -----------------------------------
    # INVALID FILTERS
    # -----------------------------------

    except PublicAIQueryExecutionError as exc:

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "PUBLIC_AI_INVALID_FILTERS",
                "message": str(exc),
            },
        ) from exc

    # -----------------------------------
    # UNSUPPORTED INTENT
    # -----------------------------------

    except UnsupportedPublicAIQueryError as exc:

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "PUBLIC_AI_UNSUPPORTED",
                "message": str(exc),
            },
        ) from exc

    # -----------------------------------
    # SERVICE FAILURE
    # -----------------------------------

    except PublicAIServiceError as exc:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "PUBLIC_AI_ERROR",
                "message": str(exc),
            },
        ) from exc

    # -----------------------------------
    # UNEXPECTED FAILURE
    # -----------------------------------

    except Exception as exc:

        logger.exception(
            "Unexpected public AI search failure."
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "PUBLIC_AI_INTERNAL_ERROR",
                "message": (
                    "Unable to complete the apartment "
                    "search."
                ),
            },
        ) from exc