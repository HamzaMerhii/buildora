from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Enum as SQLEnum,
    ForeignKey,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.task import TaskStatus


class TaskUpdate(Base):
    __tablename__ = "task_updates"

    __table_args__ = (
        CheckConstraint(
            "progress_percent >= 0 AND progress_percent <= 100",
            name="ck_task_update_progress_percent",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )

    task_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "tasks.id",
            ondelete="CASCADE",
        ),
        index=True,
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "users.id",
        ),
        index=True,
    )

    progress_percent: Mapped[int] = mapped_column()

    status: Mapped[TaskStatus] = mapped_column(
        SQLEnum(
            TaskStatus,
            name="taskstatus",
        )
    )

    notes: Mapped[Optional[str]] = mapped_column(
        nullable=True,
    )

    photo_url: Mapped[Optional[str]] = mapped_column(
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
    )

    task = relationship(
        "Task",
        back_populates="updates",
    )

    user = relationship(
        "User",
        back_populates="task_updates",
    )