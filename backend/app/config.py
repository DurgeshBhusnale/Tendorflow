from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str
    TEST_DATABASE_URL: str = ""

    JWT_SECRET: str
    JWT_ACCESS_TTL_MINUTES: int = 30
    JWT_REFRESH_TTL_DAYS: int = 7

    CORS_ORIGINS: str = "http://localhost:5173"

    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    SQLALCHEMY_ECHO: bool = False

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
