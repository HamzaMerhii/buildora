"""create apartment_images table

Revision ID: b7c2e9a14f03
Revises: 7f7c19596542
Create Date: 2026-09-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7c2e9a14f03'
down_revision: Union[str, Sequence[str], None] = '7f7c19596542'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'apartment_images',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('apartment_id', sa.Uuid(), nullable=False),
        sa.Column('image_url', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['apartment_id'], ['apartments.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_apartment_images_apartment_id'),
        'apartment_images',
        ['apartment_id'],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_apartment_images_apartment_id'), table_name='apartment_images')
    op.drop_table('apartment_images')
