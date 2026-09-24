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
from app.schemas.document import (
    DocumentCreate,
    DocumentResponse,
)
from app.services.document_service import (
    create_document,
    get_project_documents,
    get_document_details,delete_document)
from app.services.imagekit_service import upload_document_file


router = APIRouter(
    prefix=(
        "/companies/{company_id}"
        "/projects/{project_id}"
        "/documents"
    ),
    tags=["Documents"],
)


@router.post(
    "/",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_new_document(
    company_id: UUID,
    project_id: UUID,
    name: str = Form(...),
    category: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_site_management),
):
    def _clean_optional(value: Optional[str]) -> Optional[str]:
        if value is None:
            return None

        cleaned = value.strip()
        return cleaned or None

    try:
        document_data = DocumentCreate(
            name=name.strip(),
            category=_clean_optional(category),
        )
    except ValidationError as exc:
        raise RequestValidationError(exc.errors())

    file_url = await upload_document_file(file)

    return create_document(
        company_id=company_id,
        project_id=project_id,
        document=document_data,
        file_url=file_url,
        file_type=file.content_type,
        original_filename=file.filename,
        current_user=current_user,
        db=db,
    )


@router.get(
    "/",
    response_model=list[DocumentResponse],
)
def list_documents(
    company_id: UUID,
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_site_management),
):
    return get_project_documents(
        company_id=company_id,
        project_id=project_id,
        db=db,
    )
@router.get(
    "/{document_id}",
    response_model=DocumentResponse,
)
def get_document(
    company_id: UUID,
    project_id: UUID,
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_site_management),
):
    return get_document_details(
        company_id=company_id,
        project_id=project_id,
        document_id=document_id,
        db=db,
    )

@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_document(
    company_id: UUID,
    project_id: UUID,
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_site_management),
):
    delete_document(
        company_id=company_id,
        project_id=project_id,
        document_id=document_id,
        db=db,
    )