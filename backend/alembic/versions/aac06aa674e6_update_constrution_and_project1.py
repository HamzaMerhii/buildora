"""update constrution and project1

Revision ID: aac06aa674e6
Revises: 9d98762d3722
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "aac06aa674e6"
down_revision: Union[str, Sequence[str], None] = "9d98762d3722"
branch_labels = None
depends_on = None


construction_stage_status_enum = postgresql.ENUM(
    "NOT_STARTED",
    "IN_PROGRESS",
    "COMPLETED",
    name="constructionstagestatus",
    create_type=False,
)

project_status_enum = postgresql.ENUM(
    "PLANNING",
    "IN_PROGRESS",
    "COMPLETED",
    "ON_HOLD",
    name="projectstatus",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()

    # Create PostgreSQL enum types first
    construction_stage_status_enum.create(bind, checkfirst=True)
    project_status_enum.create(bind, checkfirst=True)

    # Add construction_stages.status
    op.add_column(
        "construction_stages",
        sa.Column(
            "status",
            construction_stage_status_enum,
            nullable=True,
        ),
    )

    # Add projects.status
    op.add_column(
        "projects",
        sa.Column(
            "status",
            project_status_enum,
            nullable=True,
        ),
    )


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_column("projects", "status")
    op.drop_column("construction_stages", "status")

    project_status_enum.drop(bind, checkfirst=True)
    construction_stage_status_enum.drop(bind, checkfirst=True)