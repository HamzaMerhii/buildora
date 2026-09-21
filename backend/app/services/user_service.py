from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from app.core.security import (create_access_token, hash_password)
from app.models import User, PlatformRole
from uuid import UUID
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from app.schemas import UserCreateSchema, UserUpdateSchema, UserFilterParams, UserPaginatedResponse, UserUpdateByAdminSchema
from app.dependencies import get_current_user

def create_user(
    user: UserCreateSchema,
    db: Session
):
    conditions = [
        User.email == user.email.lower().strip()
    ]

    if user.phone:
        conditions.append(
            User.phone == user.phone
        )

    existing_user = db.scalar(
        select(User).where(
            or_(*conditions)
        )
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email or Phone already registered"
        )

    new_user = User(
        name=user.name,
        email=user.email,
        phone=user.phone,
        password_hash=hash_password(user.password),
        platform_role=PlatformRole.USER,
        is_active=True
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email or phone already registered"
        )
    access_token = create_access_token(
        str(new_user.id),
        new_user.platform_role.value,
    )
    return {
        "message": "User created successfully",
        "access_token": access_token,
        "token_type": "bearer",
    }



async def update_user(user:UserUpdateSchema,client_user):
    existing_user = await User.find_one(
        {
            "email": user.email
        }
    )
    user_id = str(existing_user.id)
    if existing_user:
            if client_user.id != user_id:
                raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered"
            )
    update_data = user.model_dump(exclude_unset=True)

    if "password" in update_data and update_data["password"]:
        update_data["password"] = hash_password(update_data["password"])

    await client_user.set(update_data)
    return {
        "message": "User Updated successfully",
        "id": str(client_user.id)
    }

# async def get_paginated_users(params: UserFilterParams) -> UserPaginatedResponse:
#     query_conditions = []

#     if params.city:
#         regex_pattern = f"(?i){params.city}"
#         query_conditions.append(RegEx(User.city, regex_pattern),)

#     if params.search:
#         regex_pattern = f"(?i){params.search}"
#         query_conditions.append(
#             Or(
#                 RegEx(User.first_name, regex_pattern),
#                 RegEx(User.last_name, regex_pattern),
#                 RegEx(User.email, regex_pattern),
#             )
#         )

#     base_query = User.find(*query_conditions) if query_conditions else User.find_all()

#     total = await base_query.count()

#     skip = (params.page - 1) * params.size

#     users = (
#         await base_query
#         .sort(-User.id)
#         .skip(skip)
#         .limit(params.size)
#         .to_list()
#     )

#     pages = (total + params.size - 1) // params.size if total > 0 else 0

#     # 6. Return response matching UserPaginatedResponse schema
#     return UserPaginatedResponse(
#         items = users,
#         total=total,
#         page=params.page,
#         size=params.size,
#         pages=pages,
#     )

# async def  update_admin(id:str,user:UserUpdateByAdminSchema):
#         existing_user = await User.find_one(
#                 {
#                     "email": user.email
#                 }
#             )
#         user_id:str = str(existing_user.id)

#         if existing_user:
#                 if id != user_id:
#                     if existing_user.email == user.email:
#                         raise HTTPException(
#                         status_code=status.HTTP_409_CONFLICT,
#                         detail="Email already registered"
#                         )
#         update_data = user.model_dump(exclude_unset=True)

#         if "password" in update_data and update_data["password"]:
#             update_data["password"] = hash_password(update_data["password"])

#         await existing_user.set(update_data)
#         return {
#             "message": "User Updated successfully",
#             "id": str(id)
#         }

# async def  delete_admin(id:PydanticObjectId):
        # existing_user = await User.find_one(
        #         {
        #             "_id": id
        #         }
        #     )
        # if not existing_user:
        #     raise HTTPException(
        #             status_code=status.HTTP_404_NOT_FOUND,
        #             detail="User Not Found"
        #             )
        # existing_user.is_deleted:bool = True # type: ignore
        # existing_user.deleted_at:datetime = datetime.now(timezone.utc) # type: ignore

        # await existing_user.save()
        # return {
        #     "message": "User Soft Deleted successfully",
        #     "id": str(id)
        # }