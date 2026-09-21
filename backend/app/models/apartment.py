from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4
from enum import Enum

from sqlalchemy import ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class ApartmentStatus(str, Enum):
    AVAILABLE = "available"
    RESERVED = "reserved"
    SOLD = "sold"


class Apartment(Base):
    __tablename__ = "apartments"

    __table_args__ = (
        UniqueConstraint(
            "floor_id",
            "unit_number",
            name="uq_floor_unit_number",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )

    floor_id: Mapped[UUID] = mapped_column(
        ForeignKey("floors.id", ondelete="CASCADE"),
        index=True,
    )

    unit_number: Mapped[str] = mapped_column()

    area_sqm: Mapped[Optional[Decimal]] = mapped_column(
        nullable=True,
    )

    bedrooms: Mapped[Optional[int]] = mapped_column(
        nullable=True,
    )

    bathrooms: Mapped[Optional[int]] = mapped_column(
        nullable=True,
    )

    price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(14, 2),
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(),
        default=ApartmentStatus.AVAILABLE.value,
        nullable=False,
    )

    is_public: Mapped[bool] = mapped_column(
        default=False,
    )

    description: Mapped[Optional[str]] = mapped_column(
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
    )

    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    floor = relationship(
        "Floor",
        back_populates="apartments",
    )

    images = relationship(
        "ApartmentImage",
        back_populates="apartment",
        cascade="all, delete-orphan",
    )

    leads = relationship(
        "Lead",
        back_populates="apartment",
        cascade="all, delete-orphan",
    )