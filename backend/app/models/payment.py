from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint(
            "amount > 0",
            name="ck_payment_amount_positive",
        ),
    )
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        index=True,
    )

    party_id: Mapped[UUID] = mapped_column(
        ForeignKey("parties.id"),
        index=True,
    )

    category_id: Mapped[UUID] = mapped_column(
        ForeignKey("payment_categories.id"),
        index=True,
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2)
    )

    currency: Mapped[str] = mapped_column(
        default="USD",
    )

    payment_date: Mapped[date] = mapped_column()

    description: Mapped[Optional[str]] = mapped_column(
        nullable=True,
    )

    reference: Mapped[Optional[str]] = mapped_column(
        nullable=True,
    )

    created_by: Mapped[UUID] = mapped_column(
        ForeignKey("users.id"),
        index=True,
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
        back_populates="payments",
    )

    party = relationship(
        "Party",
        back_populates="payments",
    )

    category = relationship(
        "PaymentCategory",
        back_populates="payments",
    )

    creator = relationship(
        "User",
        back_populates="created_payments",
    )