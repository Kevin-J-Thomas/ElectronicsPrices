from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://postgres:postgres@localhost:5432/electronics_inventory"
    redis_url: str = "redis://localhost:6379/0"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    environment: str = "development"


settings = Settings()
