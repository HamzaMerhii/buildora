from datetime import date, datetime
from typing import Optional
from uuid import UUID, uuid4
from enum import Enum

from sqlalchemy import CheckConstraint, Enum as SQLEnum, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

class ConstructionStageStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class ConstructionStage(Base):
    __tablename__ = "construction_stages"
    
    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "order_index",
            name="uq_project_stage_order",
        ),
        CheckConstraint(
    "progress_percent >= 0 AND progress_percent <= 100",
    name="ck_stage_progress_percent",
    )
    )

    
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        index=True,
    )

    name: Mapped[str] = mapped_column()

    description: Mapped[Optional[str]] = mapped_column(
        nullable=True,
    )

    order_index: Mapped[int] = mapped_column()

    start_date: Mapped[Optional[date]] = mapped_column(
        nullable=True,
    )

    due_date: Mapped[Optional[date]] = mapped_column(
        nullable=True,
    )

    status: Mapped[ConstructionStageStatus] = mapped_column(
        SQLEnum(ConstructionStageStatus),
        default=ConstructionStageStatus.NOT_STARTED,
         nullable=False,
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

    project = relationship(
        "Project",
        back_populates="construction_stages",
    )

    tasks = relationship(
        "Task",
        back_populates="stage",
        cascade="all, delete-orphan",
    )