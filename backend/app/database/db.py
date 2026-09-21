from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False
)


async def init_db():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1;"))

    print("PostgreSQL connected successfully")


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()