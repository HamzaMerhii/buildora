from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Enum as SQLEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class LeadStatus(str, Enum):
    NEW = "new"
    CONTACTED = "contacted"
    CLOSED = "closed"


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )

    apartment_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "apartments.id",
            ondelete="CASCADE",
        ),
        index=True,
    )

    name: Mapped[str] = mapped_column()

    phone: Mapped[Optional[str]] = mapped_column(
        nullable=True,
    )

    email: Mapped[Optional[str]] = mapped_column(
        nullable=True,
    )

    message: Mapped[Optional[str]] = mapped_column(
        nullable=True,
    )

    status: Mapped[LeadStatus] = mapped_column(
        SQLEnum(
            LeadStatus,
            name="leadstatus",
        ),
        default=LeadStatus.NEW,
    )

    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
    )

    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    apartment = relationship(
        "Apartment",
        back_populates="leads",
    )