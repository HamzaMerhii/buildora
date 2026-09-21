from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import Project, User
from app.models import land_record
from app.models.land_record import LandRecord
from app.schemas.project import ProjectCreate, ProjectStatus, ProjectUpdate
from sqlalchemy.exc import IntegrityError
from typing import Optional


def create_project(
    company_id: UUID,
    project: ProjectCreate,
    current_user: User,
    db: Session,
):
    new_project = Project(
        company_id=company_id,
        created_by=current_user.id,
        name=project.name,
        description=project.description,
        location=project.location,
        start_date=project.start_date,
        expected_end_date=project.expected_end_date,
        status=project.status,
        budget=project.budget,
        image=project.image
    )
    try:
        db.add(new_project)
        db.flush()

        db.commit()
        db.refresh(new_project)

    except IntegrityError as exc:
        db.rollback()

        print("DATABASE ERROR:", exc)

        raise

    land_record = LandRecord(
    project_id=new_project.id,
    area_sqm=None,
    parcel_number=None,
    max_height_m=None,
)
    try:
        db.add(land_record)
        db.flush()
        db.commit()
        db.refresh(land_record)
    
    except IntegrityError as exc:
        db.rollback()
        print("DATABASE ERROR:", exc)
        raise

    return {
        "message": "Project created successfully"
        }

def get_company_projects(
    company_id: UUID,
    status: Optional[ProjectStatus],
    search: Optional[str],
    skip: int,
    limit: int,
    db: Session,
):
    query = select(Project).where(
        Project.company_id == company_id
    )

    if status is not None:
        query = query.where(
            Project.status == status
        )

    if search:
        search_term = f"%{search.strip()}%"

        query = query.where(
            or_(
                Project.name.ilike(search_term),
                Project.description.ilike(search_term),
                Project.location.ilike(search_term),
            )
        )

    query = (
        query
        .order_by(Project.created_at.desc())
        .offset(skip)
        .limit(limit)
    )

    projects = db.scalars(query).all()

    return projects



def get_project_details(
    company_id: UUID,
    project_id: UUID,
    db: Session,
):
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

    return project

def update_project(
    company_id: UUID,
    project_id: UUID,
    project: ProjectUpdate,
    db: Session,
):
    existing_project = db.scalar(
        select(Project).where(
            Project.id == project_id,
            Project.company_id == company_id,
        )
    )

    if existing_project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    update_data = project.model_dump(
        exclude_unset=True
    )

    for field, value in update_data.items():
        setattr(
            existing_project,
            field,
            value,
        )

    db.commit()
    db.refresh(existing_project)

    return existing_project