from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.dependencies.permissions import require_company_member
from app.schemas.ai import (
    AISearchRequest,
    AISearchResponse,
)
from app.services.ai_parser_service import (
    AIParserError,
)
from app.services.ai_service import (
    AIIntentPermissionError,
    AIQueryExecutionError,
    UnsupportedAIQueryError,
    execute_ai_search,
)


router = APIRouter(
    prefix="/companies/{company_id}/ai",
    tags=["AI"],
)


@router.post(
    "/search",
    response_model=AISearchResponse,
    status_code=status.HTTP_200_OK,
)
def ai_search(
    company_id: UUID,
    payload: AISearchRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_company_member),
):
    try:
        return execute_ai_search(
            db=db,
            company_id=company_id,
            query=payload.query,
            current_user=current_user,
        )

    except AIIntentPermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "AI_INTENT_FORBIDDEN",
                "message": str(exc),
            },
        ) from exc

    except UnsupportedAIQueryError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "AI_QUERY_UNSUPPORTED",
                "message": str(exc),
            },
        ) from exc

    except AIParserError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "AI_PROVIDER_ERROR",
                "message": str(exc),
            },
        ) from exc

    except AIQueryExecutionError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "AI_QUERY_EXECUTION_ERROR",
                "message": str(exc),
            },
        ) from exc

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "INVALID_AI_QUERY",
                "message": str(exc),
            },
        ) from exc