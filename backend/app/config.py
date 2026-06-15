from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration, sourced from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Core
    app_name: str = "GlinTech BOM Insight API"
    api_v1_prefix: str = "/api"

    # Database
    database_url: str = (
        "postgresql+psycopg2://glintech:glintech@localhost:5432/glintech"
    )

    # CORS – the Next.js dev/prod origins allowed to call this API.
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # File storage – local for MVP, abstracted behind FileStorageService.
    file_storage_backend: str = "local"
    local_storage_dir: str = "/data/uploads"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
