from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/watchparty"
    secret_key: str = "dev-secret"
    cors_origins: list[str] = ["http://localhost:3000"]
    room_expiration_minutes: int = 30
    max_participants: int = 50
    sync_state_interval_seconds: float = 3.0
    disconnect_grace_seconds: float = 60.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
