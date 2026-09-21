from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class ApartmentImage(Base):
    __tablename__ = "apartment_images"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )

    apartment_id: Mapped[UUID] = mapped_column(
        ForeignKey("apartments.id", ondelete="CASCADE"),
        index=True,
    )

    image_url: Mapped[str] = mapped_column()

    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
    )

    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    apartment = relationship(
        "Apartment",
        back_populates="images",
    )
