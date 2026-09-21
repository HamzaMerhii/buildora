from datetime import date, datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Enum as SQLEnum, CheckConstraint, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

from enum import Enum


class TaskStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"

class Task(Base):
    __tablename__ = "tasks"
    __tablename__ = "tasks"

    __table_args__ = (
        CheckConstraint(
            "progress_percent >= 0 AND progress_percent <= 100",
            name="ck_task_progress_percent",
        ),
    )
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )

    stage_id: Mapped[UUID] = mapped_column(
        ForeignKey("construction_stages.id", ondelete="CASCADE"),
        index=True,
    )

    title: Mapped[str] = mapped_column()

    description: Mapped[Optional[str]] = mapped_column(
        nullable=True,
    )

    assigned_to: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )

    start_date: Mapped[Optional[date]] = mapped_column(
        nullable=True,
    )

    due_date: Mapped[Optional[date]] = mapped_column(
        nullable=True,
    )

    status: Mapped[TaskStatus] = mapped_column(
    SQLEnum(TaskStatus),
    default=TaskStatus.NOT_STARTED,
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

    stage = relationship(
        "ConstructionStage",
        back_populates="tasks",
    )

    party_id: Mapped[Optional[UUID]] = mapped_column(
    ForeignKey(
        "parties.id",
        ondelete="SET NULL",
    ),
    nullable=True,
    index=True,
)

    updates = relationship(
        "TaskUpdate",
        back_populates="task",
        cascade="all, delete-orphan",
    )
    assignee = relationship(
    "User",
    back_populates="assigned_tasks",
    foreign_keys=[assigned_to],
)
    assigned_party = relationship(
    "Party",
    back_populates="tasks",
    foreign_keys=[party_id],
)