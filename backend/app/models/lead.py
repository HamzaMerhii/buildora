from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )

    apartment_id: Mapped[UUID] = mapped_column(
        ForeignKey("apartments.id", ondelete="CASCADE"),
        index=True,
    )

    name: Mapped[str] = mapped_column()

    phone: Mapped[Optional[str]] = mapped_column(
        nullable=True,
    )

    email: Mapped[Optional[str]] = mapped_column(
        nullable=True,
    )

    source: Mapped[Optional[str]] = mapped_column(
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        default="new",
    )

    message: Mapped[Optional[str]] = mapped_column(
        nullable=True,
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