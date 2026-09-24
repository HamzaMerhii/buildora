from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4
from enum import Enum

from sqlalchemy import CheckConstraint, Enum as SQLEnum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

class ProjectStatus(str, Enum):
    PLANNING = "planning"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ON_HOLD = "on_hold"

class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (
    CheckConstraint(
        "progress >= 0 AND progress <= 100",
        name="check_project_progress"
    ),
)
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )

    company_id: Mapped[UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"),
        index=True,
    )

    created_by: Mapped[UUID] = mapped_column(
        ForeignKey("users.id"),
        index=True,
    )

    name: Mapped[str] = mapped_column()

    description: Mapped[Optional[str]] = mapped_column(
        nullable=True,
    )

    location: Mapped[Optional[str]] = mapped_column(
        nullable=True,
    )

    start_date: Mapped[Optional[date]] = mapped_column(
        nullable=True,
    )

    expected_end_date: Mapped[Optional[date]] = mapped_column(
        nullable=True,
    )

    status: Mapped[ProjectStatus] = mapped_column(
        SQLEnum(ProjectStatus),
        default=ProjectStatus.PLANNING,
        nullable=False,
    )

    budget: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(14, 2),
        nullable=True,
    )
    image: Mapped[Optional[str]] = mapped_column(
            nullable=True,
        )
    progress_percent: Mapped[int] = mapped_column(
    default=0,
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
        back_populates="projects",
    )

    creator = relationship(
        "User",
        back_populates="created_projects",
    )

    land_record = relationship(
        "LandRecord",
        back_populates="project",
        uselist=False,
        cascade="all, delete-orphan",
    )

    buildings = relationship(
        "Building",
        back_populates="project",
        cascade="all, delete-orphan",
    )

    construction_stages = relationship(
        "ConstructionStage",
        back_populates="project",
        cascade="all, delete-orphan",
    )

    payments = relationship(
        "Payment",
        back_populates="project",
    )

    documents = relationship(
        "Document",
        back_populates="project",
        cascade="all, delete-orphan",
    )

    documents = relationship(
    "Document",
    back_populates="project",
    cascade="all, delete-orphan",
)