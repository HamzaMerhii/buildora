from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.dependencies.permissions import require_project_manager
from app.models import User
from app.models.apartment import ApartmentStatus
from app.schemas.apartment import PaginatedCompanyApartmentResponse
from app.services.apartment_service import get_company_apartments


router = APIRouter(
    prefix="/companies/{company_id}",
    tags=["Apartments"],
)


@router.get(
    "/apartments",
    response_model=PaginatedCompanyApartmentResponse,
    status_code=status.HTTP_200_OK,
)
def list_company_apartments(
    company_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    project_id: Optional[UUID] = Query(None),
    building_id: Optional[UUID] = Query(None),
    status: Optional[ApartmentStatus] = Query(None),
    is_public: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_project_manager),
):
    """Company-wide management apartment list with server pagination.

    The floor-scoped endpoint in app/routers/apartment.py is preserved;
    this aggregate exists so the admin list needs one request per page
    instead of traversing projects → buildings → floors → apartments.
    """
    return get_company_apartments(
        company_id=company_id,
        db=db,
        page=page,
        page_size=page_size,
        project_id=project_id,
        building_id=building_id,
        status=status,
        is_public=is_public,
    )
