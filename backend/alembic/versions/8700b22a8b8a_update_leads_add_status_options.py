from typing import Sequence, Union

from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "8700b22a8b8a"
down_revision: Union[str, Sequence[str], None] = "bf3e732358a4"
branch_labels = None
depends_on = None


lead_status_enum = postgresql.ENUM(
    "NEW",
    "CONTACTED",
    "CLOSED",
    name="leadstatus",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Create enum type
    lead_status_enum.create(bind, checkfirst=True)

    # 2. Normalize existing varchar values
    op.execute(
        """
        UPDATE leads
        SET status = UPPER(status)
        WHERE status IS NOT NULL
        """
    )

    # 3. Convert column to PostgreSQL enum
    op.execute(
        """
        ALTER TABLE leads
        ALTER COLUMN status
        TYPE leadstatus
        USING status::leadstatus
        """
    )


def downgrade() -> None:
    bind = op.get_bind()

    # Convert enum back to varchar
    op.execute(
        """
        ALTER TABLE leads
        ALTER COLUMN status
        TYPE VARCHAR
        USING status::text
        """
    )

    # Remove enum type
    lead_status_enum.drop(bind, checkfirst=True)