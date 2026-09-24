from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class PlatformRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    USER = "user"


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4
    )

    name: Mapped[str] = mapped_column()

    email: Mapped[str] = mapped_column(
        unique=True,
        index=True
    )

    phone: Mapped[str] = mapped_column(
        unique=True,
        index=True,
    )

    password_hash: Mapped[str] = mapped_column()

    platform_role: Mapped[PlatformRole] = mapped_column(
        SQLEnum(PlatformRole),
        default=PlatformRole.USER
    )

    is_active: Mapped[bool] = mapped_column(
        default=True
    )

    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow
    )
    
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    memberships = relationship(
    "CompanyMembership",
    back_populates="user",
    cascade="all, delete-orphan",
    )

    created_projects = relationship(
    "Project",
    back_populates="creator",
    )

    task_updates = relationship(
    "TaskUpdate",
    back_populates="user",
    )

    created_payments = relationship(
    "Payment",
    back_populates="creator",
    )

    uploaded_documents = relationship(
    "Document",
    back_populates="uploader",
    )
    assigned_tasks = relationship(
    "Task",
    back_populates="assignee",
    foreign_keys="Task.assigned_to",
    )
    uploaded_documents = relationship(
    "Document",
    back_populates="uploader",
)