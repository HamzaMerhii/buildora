from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.database.db import get_db
from app.models import User
from typing import Annotated
# from app.dependencies import require_admin, require_client
from app.schemas import UserCreateSchema,UserOutSchema,UserUpdateSchema, UserFilterParams, UserUpdateByAdminSchema
from app.services.user_service import (
    create_user,
    # update_user,
    # get_paginated_users,
    # update_admin,
    # delete_admin
)

#Defines authentication endpoints:
router = APIRouter(
    prefix="/users",
    tags=["Users"]
)

@router.post(
    "/",
    status_code=status.HTTP_201_CREATED
)
def create_new_user(
    user: UserCreateSchema,
    db: Session = Depends(get_db)
):
    return create_user(
        user,
        db
    )


# @router.get(
#     "/me",
#     response_model=UserOutSchema,
#     status_code=status.HTTP_200_OK
# )
# async def user_profile(
#     current_user:User = Depends(require_client)
# ):
#     return current_user

# @router.put(
#     "/me",
#     status_code=status.HTTP_200_OK
# )
# async def handle_update_user(
#     user: UserUpdateSchema,
#     cleint_user:User = Depends(require_client)
# ):
#     return await update_user(user,cleint_user)

# @router.get("/")
# async def list_users(
#     filters: Annotated[UserFilterParams, Depends()],
#     user_admin: User = Depends(require_admin)
# ): 
#     return await get_paginated_users(filters)

# @router.put(
#     "/{id}",
#     status_code=status.HTTP_200_OK
# )
# async def handle_update_admin(
#     id:str,
#     user: UserUpdateByAdminSchema,
#     admin_user:User = Depends(require_admin)
# ):
#     return await update_admin(id,user)



# @router.delete(
#     "/{id}",
#     status_code=status.HTTP_204_NO_CONTENT
# )
# async def handle_delete_admin(
#     id:PydanticObjectId,
#     admin_user:User = Depends(require_admin)
# ):
#     return await delete_admin(id)

# @router.get(
#     "/",
#     status_code=status.HTTP_204_NO_CONTENT
# )
# async def handle_delete_admin(
#     id:PydanticObjectId,
#     admin_user:User = Depends(require_admin)
# ):
#     return await delete_admin(id)