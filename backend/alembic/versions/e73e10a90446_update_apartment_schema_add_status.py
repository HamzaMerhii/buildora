"""update apartment schema add status

Revision ID: e73e10a90446
Revises: dda0e8902d1f
Create Date: 2026-09-18 14:26:44.674405

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e73e10a90446'
down_revision: Union[str, Sequence[str], None] = 'dda0e8902d1f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None
"""update apartment schema add status

Revision ID: e73e10a90446
Revises: dda0e8902d1f
Create Date: 2026-09-18 14:26:44.674405
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.

revision: str = "e73e10a90446"
down_revision: Union[str, Sequence[str], None] = "dda0e8902d1f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass