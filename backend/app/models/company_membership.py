from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import Enum as SQLEnum, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class CompanyRole(str, Enum):
    OWNER = "owner"
    PROJECT_MANAGER = "project_manager"
    SITE_ENGINEER = "site_engineer"
    SALES = "sales"
    FINANCE = "finance"


class CompanyMembership(Base):
    __tablename__ = "company_memberships"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "company_id",
            name="uq_user_company_membership",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )

    company_id: Mapped[UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"),
        index=True,
    )

    role: Mapped[CompanyRole] = mapped_column(
        SQLEnum(CompanyRole),
        default=CompanyRole.OWNER,
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

    user = relationship(
        "User",
        back_populates="memberships",
    )

    company = relationship(
        "Company",
        back_populates="memberships",
    )