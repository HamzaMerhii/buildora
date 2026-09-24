from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Company, Party
from app.schemas.party import PartyCreate, PartyUpdate


def create_party(
    company_id: UUID,
    party: PartyCreate,
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

    new_party = Party(
        **party.model_dump(),
        company_id=company_id,
    )

    db.add(new_party)
    db.commit()
    db.refresh(new_party)

    return new_party

def get_company_parties(
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

    parties = db.scalars(
        select(Party)
        .where(
            Party.company_id == company_id
        )
        .order_by(
            Party.created_at.desc()
        )
    ).all()

    return parties

def get_party_details(
    company_id: UUID,
    party_id: UUID,
    db: Session,
):
    party = db.scalar(
        select(Party).where(
            Party.id == party_id,
            Party.company_id == company_id,
        )
    )

    if party is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Party not found",
        )

    return party

def update_party(
    company_id: UUID,
    party_id: UUID,
    party: PartyUpdate,
    db: Session,
):
    existing_party = db.scalar(
        select(Party).where(
            Party.id == party_id,
            Party.company_id == company_id,
        )
    )

    if existing_party is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Party not found",
        )

    update_data = party.model_dump(
        exclude_unset=True
    )

    for field, value in update_data.items():
        setattr(
            existing_party,
            field,
            value,
        )

    db.commit()
    db.refresh(existing_party)

    return existing_party