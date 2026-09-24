"""update project and construction stage add project progress

Revision ID: ed264c246a19
Revises: b7952b1bf811
Create Date: 2026-09-21 12:49:32.316455

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ed264c246a19'
down_revision: Union[str, Sequence[str], None] = 'b7952b1bf811'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "construction_stages",
        sa.Column(
            "progress_percent",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )

    op.alter_column(
        "construction_stages",
        "progress_percent",
        server_default=None,
    )

    op.add_column(
        "projects",
        sa.Column(
            "progress_percent",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )

    op.alter_column(
        "projects",
        "progress_percent",
        server_default=None,
    )