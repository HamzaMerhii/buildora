from uuid import UUID, uuid4

from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class PaymentCategory(Base):
    __tablename__ = "payment_categories"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )

    name: Mapped[str] = mapped_column(
        unique=True,
    )

    description: Mapped[str | None] = mapped_column(
        nullable=True,
    )

    payments = relationship(
        "Payment",
        back_populates="category",
    )