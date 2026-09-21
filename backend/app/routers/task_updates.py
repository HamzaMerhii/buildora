from typing import Optional
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    UploadFile,
    status,
)
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.dependencies.permissions import require_site_management
from app.models import User
from app.models.task import TaskStatus
from app.schemas.task_update import (
    TaskUpdateCreate,
    TaskUpdateResponse,
)
from app.services.imagekit_service import upload_task_update_image
from app.services.task_update_service import create_task_update


router = APIRouter(
    prefix=(
        "/companies/{company_id}"
        "/projects/{project_id}"
        "/stages/{stage_id}"
        "/tasks/{task_id}"
        "/updates"
    ),
    tags=["Task Updates"],
)


@router.post(
    "/",
    response_model=TaskUpdateResponse,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/",
    response_model=TaskUpdateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_new_task_update(
    company_id: UUID,
    project_id: UUID,
    stage_id: UUID,
    task_id: UUID,
    progress_percent: int = Form(...),
    task_status: TaskStatus = Form(...),
    notes: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_site_management),
):
    def _clean_optional(value: Optional[str]) -> Optional[str]:
        if value is None:
            return None

        cleaned = value.strip()
        return cleaned or None

    try:
        task_update_data = TaskUpdateCreate(
            progress_percent=progress_percent,
            status=task_status,
            notes=_clean_optional(notes),
        )
    except ValidationError as exc:
        raise RequestValidationError(exc.errors())

    photo_url: Optional[str] = None

    if image is not None:
        photo_url = await upload_task_update_image(image)

    return create_task_update(
        company_id=company_id,
        project_id=project_id,
        stage_id=stage_id,
        task_id=task_id,
        task_update=task_update_data,
        db=db,
        current_user=current_user,
        photo_url=photo_url,
    )