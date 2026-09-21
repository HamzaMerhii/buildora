"""update task schema add taskStatus

Revision ID: 0467c8a11451
Revises: 170bfbf9cc09
Create Date: 2026-09-20 12:21:21.137428
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.

revision: str = "0467c8a11451"
down_revision: Union[str, Sequence[str], None] = "170bfbf9cc09"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


task_status_enum = postgresql.ENUM(
    "NOT_STARTED",
    "IN_PROGRESS",
    "COMPLETED",
    name="taskstatus",
    create_type=False,
)


def upgrade() -> None:
    """Upgrade schema."""

    bind = op.get_bind()

    # Create PostgreSQL enum type first
    task_status_enum.create(bind, checkfirst=True)

    # Convert existing VARCHAR values if they are lowercase
    op.execute(
        """
        UPDATE tasks
        SET status = UPPER(status)
        WHERE status IS NOT NULL
        """
    )

    # Convert column from VARCHAR to PostgreSQL ENUM
    op.execute(
        """
        ALTER TABLE tasks
        ALTER COLUMN status
        TYPE taskstatus
        USING status::taskstatus
        """
    )


def downgrade() -> None:
    """Downgrade schema."""

    bind = op.get_bind()

    # Convert enum back to VARCHAR first
    op.execute(
        """
        ALTER TABLE tasks
        ALTER COLUMN status
        TYPE VARCHAR
        USING status::text
        """
    )

    # Then remove PostgreSQL enum type
    task_status_enum.drop(bind, checkfirst=True)