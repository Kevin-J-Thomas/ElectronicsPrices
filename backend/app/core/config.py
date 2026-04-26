from pydantic_settings import BaseSettings, SettingsConfigDict

_DEV_ORIGINS = [
    "http://localhost:3000",
    "http://inventory.local",
]

_PROD_ORIGINS = [
    "https://grattchi.tech",
    "https://www.grattchi.tech",
    "https://api.grattchi.tech",
]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://postgres:postgres@localhost:5432/electronics_inventory"
    redis_url: str = "redis://localhost:6379/0"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    environment: str = "development"
    admin_api_key: str = "change-me-in-production"

    @property
    def cors_origins(self) -> list[str]:
        if self.environment == "production":
            return _PROD_ORIGINS
        return _DEV_ORIGINS + _PROD_ORIGINS


settings = Settings()
