from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "projects.id",
            ondelete="CASCADE",
        ),
        index=True,
    )

    uploaded_by: Mapped[UUID] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    name: Mapped[str] = mapped_column()

    category: Mapped[Optional[str]] = mapped_column(
        nullable=True,
    )

    file_url: Mapped[str] = mapped_column()

    file_type: Mapped[Optional[str]] = mapped_column(
        nullable=True,
    )

    original_filename: Mapped[Optional[str]] = mapped_column(
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
    )

    project = relationship(
        "Project",
        back_populates="documents",
    )

    uploader = relationship(
        "User",
        back_populates="uploaded_documents",
    )