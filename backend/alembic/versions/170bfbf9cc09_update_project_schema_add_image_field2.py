from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "170bfbf9cc09"
down_revision: Union[str, Sequence[str], None] = "b7c2e9a14f03"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("image", sa.String(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("projects", "image")