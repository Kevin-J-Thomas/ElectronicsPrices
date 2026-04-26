from app.core.config import settings


def test_config_loads():
    assert settings.api_port == 8000
    assert settings.environment in ("development", "test", "production")


def test_database_url_configured():
    assert settings.database_url.startswith("postgresql://")
