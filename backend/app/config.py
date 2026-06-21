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

    # Official supplier API credentials (Digi-Key, Mouser, TI).
    digikey_client_id: str = ""
    digikey_client_secret: str = ""
    digikey_env: str = "sandbox"
    mouser_api_key: str = ""
    ti_client_id: str = ""
    ti_client_secret: str = ""
    supplier_api_timeout_seconds: int = 20
    supplier_api_max_retries: int = 2
    supplier_api_mock: bool = False
    supplier_api_mock_allow_export: bool = False

    @property
    def digikey_configured(self) -> bool:
        return bool(self.digikey_client_id.strip() and self.digikey_client_secret.strip())

    @property
    def mouser_configured(self) -> bool:
        return bool(self.mouser_api_key.strip())

    @property
    def ti_configured(self) -> bool:
        return bool(self.ti_client_id.strip() and self.ti_client_secret.strip())

    @property
    def digikey_api_base(self) -> str:
        if self.digikey_env.lower() == "production":
            return "https://api.digikey.com"
        return "https://sandbox-api.digikey.com"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
