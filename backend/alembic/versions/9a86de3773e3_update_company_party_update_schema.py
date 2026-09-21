from typing import Sequence, Union

from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "9a86de3773e3"
down_revision: Union[str, Sequence[str], None] = "c10482eb36d8"
branch_labels = None
depends_on = None


party_type_enum = postgresql.ENUM(
    "PERSON",
    "ORGANIZATION",
    name="partytype",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()

    party_type_enum.create(bind, checkfirst=True)

    op.execute("""
        UPDATE parties
        SET type = UPPER(type)
        WHERE type IS NOT NULL
    """)

    op.execute("""
        ALTER TABLE parties
        ALTER COLUMN type
        TYPE partytype
        USING type::partytype
    """)


def downgrade() -> None:
    bind = op.get_bind()

    op.execute("""
        ALTER TABLE parties
        ALTER COLUMN type
        TYPE VARCHAR
        USING type::text
    """)

    party_type_enum.drop(bind, checkfirst=True)