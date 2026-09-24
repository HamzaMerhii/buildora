from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.db import get_db
from app.models import User, user


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login"
)


def get_current_user(
    token: Annotated[
        str,
        Depends(oauth2_scheme)
    ],
    db: Session = Depends(get_db),
) -> User:

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={
            "WWW-Authenticate": "Bearer"
        },
    )

    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[
                settings.algorithm
            ],
        )

        user_id = payload.get("sub")

        if user_id is None:
            raise credentials_exception

    except InvalidTokenError:
        raise credentials_exception

    try:
        user_uuid = UUID(user_id)

    except (ValueError, TypeError):
        raise credentials_exception

    user = db.scalar(
    select(User).where(
        User.id == user_uuid,
        User.deleted_at.is_(None),
    )
)

    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    return user