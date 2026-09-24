from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4
from enum import Enum
from sqlalchemy import ForeignKey, Enum as SQLEnum

from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

class PartyType(str, Enum):
    CONTRACTOR = "contractor"
    SUPPLIER = "supplier"


class Party(Base):
    __tablename__ = "parties"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )

    company_id: Mapped[UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"),
        index=True,
    )

    name: Mapped[str] = mapped_column()

    type: Mapped[PartyType] = mapped_column(
        SQLEnum(
            PartyType,
            name="partytype",
        )
    )
    phone: Mapped[Optional[str]] = mapped_column(
        nullable=True,
    )

    email: Mapped[Optional[str]] = mapped_column(
        nullable=True,
    )

    address: Mapped[Optional[str]] = mapped_column(
        nullable=True,
    )

    notes: Mapped[Optional[str]] = mapped_column(
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
    )

    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
    company = relationship(
        "Company",
        back_populates="parties",
    )

    payments = relationship(
        "Payment",
        back_populates="party",
    )

    tasks = relationship(
        "Task",
        back_populates="assigned_party",
    )