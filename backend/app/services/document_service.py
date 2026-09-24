from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Document,
    Project,
    User,
)
from app.schemas.document import DocumentCreate


def create_document(
    company_id: UUID,
    project_id: UUID,
    document: DocumentCreate,
    file_url: str,
    file_type: Optional[str],
    original_filename: Optional[str],
    current_user: User,
    db: Session,
):
    # Verify project belongs to company
    project = db.scalar(
        select(Project).where(
            Project.id == project_id,
            Project.company_id == company_id,
        )
    )

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    new_document = Document(
        **document.model_dump(),
        project_id=project_id,
        uploaded_by=current_user.id,
        file_url=file_url,
        file_type=file_type,
        original_filename=original_filename,
    )

    db.add(new_document)
    db.commit()
    db.refresh(new_document)

    return new_document


def get_project_documents(
    company_id: UUID,
    project_id: UUID,
    db: Session,
):
    # Verify project belongs to company
    project = db.scalar(
        select(Project).where(
            Project.id == project_id,
            Project.company_id == company_id,
        )
    )

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    documents = db.scalars(
        select(Document)
        .where(
            Document.project_id == project_id
        )
        .order_by(
            Document.created_at.desc()
        )
    ).all()

    return documents


def get_document_details(
    company_id: UUID,
    project_id: UUID,
    document_id: UUID,
    db: Session,
):
    # Verify project belongs to company
    project = db.scalar(
        select(Project).where(
            Project.id == project_id,
            Project.company_id == company_id,
        )
    )

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Verify document belongs to project
    document = db.scalar(
        select(Document).where(
            Document.id == document_id,
            Document.project_id == project_id,
        )
    )

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    return document


def delete_document(
    company_id: UUID,
    project_id: UUID,
    document_id: UUID,
    db: Session,
):
    # Verify project belongs to company
    project = db.scalar(
        select(Project).where(
            Project.id == project_id,
            Project.company_id == company_id,
        )
    )

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Verify document belongs to project
    document = db.scalar(
        select(Document).where(
            Document.id == document_id,
            Document.project_id == project_id,
        )
    )

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    db.delete(document)
    db.commit()