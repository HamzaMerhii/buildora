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
    SMTP_USER: str = ""
    SMTP_PASSWORD: str
    FROM_EMAIL: str
    SMTP_PORT: int = 465
    MAIL_SERVER: str = "smtp.hostinger.com"
    MAIL_FROM_NAME: str = "Buildora"

    FRONTEND_URL: str = "http://localhost:3000"
    access_token_expire_minutes: int = 180

    IMAGEKIT_PUBLIC_KEY: str = ""
    IMAGEKIT_PRIVATE_KEY: str = ""
    IMAGEKIT_URL_ENDPOINT: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )


settings = Settings()