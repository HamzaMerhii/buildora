from datetime import datetime, timedelta, timezone
import jwt
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash
from app.core.config import settings
from uuid import uuid4
from app.core.redis import redis_client
password_hash = PasswordHash.recommended()
#security-related functionality
#Password hashing
#Password verification
#JWT creation
def hash_password(password: str) -> str:
    return password_hash.hash(password)

def verify_password(
    password: str,
    hashed_password: str
) -> bool:
    return password_hash.verify(
        password,
        hashed_password
    )


def create_access_token(user_id: str, type: str) -> str:
    expire = (
        datetime.now(timezone.utc)
        + timedelta(
            minutes=settings.access_token_expire_minutes
        )
    )

    payload = {
        "sub": user_id,
        "type": type,
        "exp": expire
    }

    return jwt.encode(
        payload,
        settings.secret_key,
        algorithm=settings.algorithm
    )


RESET_PASSWORD_TOKEN_EXPIRE_MINUTES = 15


def create_password_reset_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=RESET_PASSWORD_TOKEN_EXPIRE_MINUTES
    )

    # Unique ID for this specific token
    jti = str(uuid4())

    payload = {
        "sub": str(user_id),
        "type": "password_reset",
        "jti": jti,
        "exp": expire,
    }

    token = jwt.encode(
        payload,
        settings.secret_key,
        algorithm=settings.algorithm,
    )

    # Store the token ID temporarily.
    # It automatically disappears when the token expires.
    redis_client.setex(
        f"password_reset:{jti}",
        RESET_PASSWORD_TOKEN_EXPIRE_MINUTES * 60,
        str(user_id),
    )

    return token


def verify_password_reset_token(token: str) -> str | None:
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm],
        )
    except InvalidTokenError:
        return None

    if payload.get("type") != "password_reset":
        return None

    user_id = payload.get("sub")
    jti = payload.get("jti")

    if not user_id or not jti:
        return None

    key = f"password_reset:{jti}"

    # GETDEL is important:
    # 1. Check whether the token exists
    # 2. Delete it atomically
    #
    # That means only the first request can use it.
    stored_user_id = redis_client.getdel(key)

    if stored_user_id is None:
        # Token was already used, revoked, or expired
        return None

    if isinstance(stored_user_id, bytes):
        stored_user_id = stored_user_id.decode()

    if stored_user_id != str(user_id):
        return None

    return str(user_id)