from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str | None = None
    supabase_publishable_key: str | None = None
    supabase_db_url: str | None = None
    switchroute_secret_key: str | None = None
    switchroute_secret_key_id: str = "local-v1"
    switchroute_key_pepper: str | None = None
    web_origins: str = "http://localhost:3000"
    enable_test_provider: bool = False
    redis_url: str | None = None

    @property
    def allowed_origins(self) -> list[str]:
        return [item.strip() for item in self.web_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
