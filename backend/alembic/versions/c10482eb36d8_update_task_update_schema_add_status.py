from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c10482eb36d8"
down_revision: Union[str, Sequence[str], None] = "0467c8a11451"
branch_labels = None
depends_on = None


task_status_enum = postgresql.ENUM(
    "NOT_STARTED",
    "IN_PROGRESS",
    "COMPLETED",
    name="taskstatus",
    create_type=False,
)


def upgrade() -> None:
    op.add_column(
        "task_updates",
        sa.Column(
            "status",
            task_status_enum,
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("task_updates", "status")