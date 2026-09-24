from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Company,
    Project,
    Building,
    Floor,
    Apartment,
    Lead,
)
from app.schemas.lead import LeadCreate, LeadUpdate


def create_lead(
    company_id: UUID,
    project_id: UUID,
    building_id: UUID,
    floor_id: UUID,
    apartment_id: UUID,
    lead: LeadCreate,
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

    # Verify building belongs to project
    building = db.scalar(
        select(Building).where(
            Building.id == building_id,
            Building.project_id == project_id,
        )
    )

    if building is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Building not found",
        )

    # Verify floor belongs to building
    floor = db.scalar(
        select(Floor).where(
            Floor.id == floor_id,
            Floor.building_id == building_id,
        )
    )

    if floor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Floor not found",
        )

    # Verify apartment belongs to floor
    apartment = db.scalar(
        select(Apartment).where(
            Apartment.id == apartment_id,
            Apartment.floor_id == floor_id,
        )
    )

    if apartment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Apartment not found",
        )

    new_lead = Lead(
        **lead.model_dump(),
        apartment_id=apartment_id,
    )

    db.add(new_lead)
    db.commit()
    db.refresh(new_lead)

    return new_lead


def get_company_leads(
    company_id: UUID,
    db: Session,
):
    # Verify company exists
    company = db.scalar(
        select(Company).where(
            Company.id == company_id
        )
    )

    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )

    leads = db.scalars(
        select(Lead)
        .join(
            Apartment,
            Lead.apartment_id == Apartment.id,
        )
        .join(
            Floor,
            Apartment.floor_id == Floor.id,
        )
        .join(
            Building,
            Floor.building_id == Building.id,
        )
        .join(
            Project,
            Building.project_id == Project.id,
        )
        .where(
            Project.company_id == company_id
        )
        .order_by(
            Lead.created_at.desc()
        )
    ).all()

    return leads
def get_lead_details(
    company_id: UUID,
    lead_id: UUID,
    db: Session,
):
    # Verify project belongs to company
    company = db.scalar(
        select(Company).where(
            Company.id == company_id,
        )
    )

    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )

    # Verify lead belongs to this project
    lead = db.scalar(
            select(Lead)
            .join(
                Apartment,
                Lead.apartment_id == Apartment.id,
            )
            .join(
                Floor,
                Apartment.floor_id == Floor.id,
            )
            .join(
                Building,
                Floor.building_id == Building.id,
            )
            .join(
                Project,
                Building.project_id == Project.id,
            )
            .where(
                Lead.id == lead_id,
                Project.company_id == company_id,
            )
    )


    if lead is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found",
        )

    return lead




def update_lead_details(
    company_id: UUID,
    lead_id: UUID,
    lead_update: LeadUpdate,
    db: Session,
):
    # Verify project belongs to company
    company = db.scalar(
        select(Company).where(
            Company.id == company_id,
        )
    )

    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )

    # Verify lead belongs to this company
    lead = db.scalar(
                select(Lead)
                .join(
                    Apartment,
                    Lead.apartment_id == Apartment.id,
                )
                .join(
                    Floor,
                    Apartment.floor_id == Floor.id,
                )
                .join(
                    Building,
                    Floor.building_id == Building.id,
                )
                .join(
                    Project,
                    Building.project_id == Project.id,
                )
                .where(
                    Lead.id == lead_id,
                    Project.company_id == company_id,
                )
        )
    
    
    if lead is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found",
        )

    update_data = lead_update.model_dump(
        exclude_unset=True
    )

    for field, value in update_data.items():
        setattr(
            lead,
            field,
            value,
        )

    db.commit()
    db.refresh(lead)

    return lead