from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Floor(Base):
    __tablename__ = "floors"
    __table_args__ = (
        UniqueConstraint(
            "building_id",
            "floor_number",
            name="uq_building_floor_number",
        ),
    )
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )

    building_id: Mapped[UUID] = mapped_column(
        ForeignKey("buildings.id", ondelete="CASCADE"),
        index=True,
    )

    name: Mapped[Optional[str]] = mapped_column(
        nullable=True,
    )

    floor_number: Mapped[int] = mapped_column()

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

    building = relationship(
        "Building",
        back_populates="floors",
    )

    apartments = relationship(
        "Apartment",
        back_populates="floor",
        cascade="all, delete-orphan",
    )