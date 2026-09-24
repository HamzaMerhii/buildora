from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

# from app.routers import auth, users, dashboard
from app.core.config import settings
from app.database.db import engine, init_db
from app.routers import apartment, auth, building, company, construction_stage, dashboard,document,floor, land_record, lead, payment, platform, payment_category, task_updates, task, party, users, project

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    print("PostgreSQL connected successfully")

    yield


app = FastAPI(
    title="Buildora API",
    lifespan=lifespan
)

allowed_origins = [
    settings.FRONTEND_URL.rstrip("/") if settings.FRONTEND_URL else "",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

allowed_origins = [
    origin for origin in allowed_origins
    if origin
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(company.router)
app.include_router(project.router)
app.include_router(land_record.router)
app.include_router(building.router)
app.include_router(floor.router)
app.include_router(apartment.router)
app.include_router(construction_stage.router)
app.include_router(task.router)
app.include_router(task_updates.router)
app.include_router(party.router)
app.include_router(payment.router)
app.include_router(document.router)
app.include_router(payment_category.router)
app.include_router(lead.router)
app.include_router(platform.router)
app.include_router(dashboard.router)
@app.get("/")
async def root():
    return {
        "message": "Buildora API is running!"
    }


@app.get("/test-db")
def test_database():
    with engine.connect() as connection:
        result = connection.execute(
            text("SELECT version();")
        )

        return {
            "status": "connected",
            "database": result.scalar()
        }