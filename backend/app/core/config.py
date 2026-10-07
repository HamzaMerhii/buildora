from pydantic_settings import BaseSettings, SettingsConfigDict

#reads values from .env file
#.env
# ↓
#config.py
# ↓
#settings
# ↓
#application
class Settings(BaseSettings):
    DATABASE_URL: str

    secret_key: str
    algorithm: str = "HS256"
    FROM_EMAIL: str
    MAIL_FROM_NAME: str = "Buildora"
    REDIS_URL: str
    FRONTEND_URL: str = "http://localhost:3000"
    access_token_expire_minutes: int = 180
    RESEND_API_KEY: str
    FROM_EMAIL: str
    MAIL_FROM_NAME: str = "Buildora"
    IMAGEKIT_PUBLIC_KEY: str = ""
    IMAGEKIT_PRIVATE_KEY: str = ""
    IMAGEKIT_URL_ENDPOINT: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )


settings = Settings()