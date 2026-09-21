from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile, status,Query
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.dependencies.permissions import require_project_manager,require_site_management
from app.models import User
from app.models.project import ProjectStatus
from app.schemas.project import ProjectCreate, ProjectCreateResponse, ProjectResponse, ProjectUpdate
from app.services.imagekit_service import upload_project_image
from app.services.project_service import (
    create_project,
    get_company_projects,
    get_project_details,
    update_project)


router = APIRouter(
    prefix="/companies/{company_id}/projects",
    tags=["Projects"],
)


@router.post(
    "/",
    response_model=ProjectCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_new_project(
    company_id: UUID,
    name: str = Form(...),
    description: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    start_date: Optional[date] = Form(None),
    expected_end_date: Optional[date] = Form(None),
    status: ProjectStatus = Form(ProjectStatus.PLANNING),
    budget: Optional[Decimal] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_project_manager),
):
    def _clean_optional(value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    try:
        project_data = ProjectCreate(
            name=name.strip(),
            description=_clean_optional(description),
            location=_clean_optional(location),
            start_date=start_date,
            expected_end_date=expected_end_date,
            status=status,
            budget=budget,
        )
    except ValidationError as exc:
        raise RequestValidationError(exc.errors())

    image_url: Optional[str] = None
    if image is not None:
        image_url = await upload_project_image(image)

    project_data.image = image_url

    return create_project(
        company_id=company_id,
        project=project_data,
        current_user=current_user,
        db=db,
    )


@router.get(
    "/",
    response_model=list[ProjectResponse],
)
def list_projects(
    company_id: UUID,

    status: Optional[ProjectStatus] = Query(
        default=None,
        description="Filter projects by status",
    ),

    search: Optional[str] = Query(
        default=None,
        min_length=1,
        description="Search by name, description, or location",
    ),

    skip: int = Query(
        default=0,
        ge=0,
    ),

    limit: int = Query(
        default=20,
        ge=1,
        le=100,
    ),

    db: Session = Depends(get_db),

    current_user: User = Depends(
        require_site_management
    ),
):
    return get_company_projects(
        company_id=company_id,
        status=status,
        search=search,
        skip=skip,
        limit=limit,
        db=db,
    )


@router.get(
    "/{project_id}",
    response_model=ProjectResponse,
    status_code=status.HTTP_200_OK,
)
def display_project_details(
    company_id: UUID,
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_project_manager),
):
    return get_project_details(
        company_id=company_id,
        project_id=project_id,
        db=db,
    )


@router.patch(
    "/{project_id}",
    response_model=ProjectResponse,
    status_code=status.HTTP_200_OK,
)
async def update_existing_project(
    company_id: UUID,
    project_id: UUID,
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    start_date: Optional[date] = Form(None),
    expected_end_date: Optional[date] = Form(None),
    status: Optional[ProjectStatus] = Form(None),
    budget: Optional[Decimal] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_project_manager),
):
    def _clean_optional(value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    # Partial PATCH semantics for multipart: only explicitly supplied
    # (non-blank) values are applied, everything else stays untouched.
    # This mirrors the create endpoint — blank strings count as
    # "not supplied", so a field can never be wiped by accident.
    # Explicit clearing via PATCH is not supported.
    supplied: dict = {}

    cleaned_name = _clean_optional(name)
    if cleaned_name is not None:
        supplied["name"] = cleaned_name

    cleaned_description = _clean_optional(description)
    if cleaned_description is not None:
        supplied["description"] = cleaned_description

    cleaned_location = _clean_optional(location)
    if cleaned_location is not None:
        supplied["location"] = cleaned_location

    if start_date is not None:
        supplied["start_date"] = start_date

    if expected_end_date is not None:
        supplied["expected_end_date"] = expected_end_date

    if status is not None:
        supplied["status"] = status

    if budget is not None:
        supplied["budget"] = budget

    try:
        project_data = ProjectUpdate(**supplied)
    except ValidationError as exc:
        raise RequestValidationError(exc.errors())

    if image is not None:
        project_data.image = await upload_project_image(image)

    return update_project(
        company_id=company_id,
        project_id=project_id,
        project=project_data,
        db=db,
    )
