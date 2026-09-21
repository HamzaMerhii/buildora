from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class LandRecord(Base):
    __tablename__ = "land_records"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )

    area_sqm: Mapped[Optional[Decimal]] = mapped_column(
        nullable=True,
    )

    parcel_number: Mapped[Optional[str]] = mapped_column(
        nullable=True,
    )

    max_height_m: Mapped[Optional[Decimal]] = mapped_column(
        nullable=True,
    )

    building_ratio: Mapped[Optional[Decimal]] = mapped_column(
        nullable=True,
    )

    constraints: Mapped[Optional[str]] = mapped_column(
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

    project = relationship(
        "Project",
        back_populates="land_record",
    )