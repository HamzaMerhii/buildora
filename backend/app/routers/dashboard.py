from fastapi import APIRouter, status
from app.models import User
from app.services.dashboard_service import (
    get_total_users,
    get_average_age,
    get_top_cities
   
)

#Defines authentication endpoints:
router = APIRouter(
    prefix="/stats",
    tags=["Dashboard"]
)


@router.get(
    "/count",
    status_code=status.HTTP_200_OK
)
async def handle_get_total_users():
    return await get_total_users()


@router.get(
    "/average-age",
    status_code=status.HTTP_200_OK
)
async def handle_get_average_age():
    return await get_average_age()

@router.get(
    "/top-cities",
    status_code=status.HTTP_200_OK
)
async def handle_get_top_cities():
    return await get_top_cities()
