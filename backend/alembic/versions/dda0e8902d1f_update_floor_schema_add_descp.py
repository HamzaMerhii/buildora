"""update floor schema add descp

Revision ID: dda0e8902d1f
Revises: 883943f24f48
Create Date: 2026-09-18 10:16:22.020883
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "dda0e8902d1f"
down_revision: Union[str, Sequence[str], None] = "883943f24f48"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "floors",
        sa.Column("description", sa.String(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("floors", "description")