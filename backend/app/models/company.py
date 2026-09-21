from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )

    name: Mapped[str] = mapped_column()

    email: Mapped[Optional[str]] = mapped_column(
        nullable=True,
    )

    phone: Mapped[Optional[str]] = mapped_column(
        nullable=True,
    )

    address: Mapped[Optional[str]] = mapped_column(
        nullable=True,
    )

    logo: Mapped[Optional[str]] = mapped_column(
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        default=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
    )

    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    memberships = relationship(
        "CompanyMembership",
        back_populates="company",
        cascade="all, delete-orphan",
    )

    projects = relationship(
        "Project",
        back_populates="company",
    )

    parties = relationship(
    "Party",
    back_populates="company",
    cascade="all, delete-orphan",
)
    