from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Site(Base):
    """A scraping target — one row per e-commerce site (34 in total)."""

    __tablename__ = "sites"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    base_url: Mapped[str] = mapped_column(String(500))
    scraper_type: Mapped[str] = mapped_column(String(50))  # static | dynamic | api | location
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    requires_location: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_auth: Mapped[bool] = mapped_column(Boolean, default=False)

    # Scraper-specific config — category URLs, CSS selectors, pagination rules
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    # Category list: ["laptops", "ssds", "ram", ...]
    categories: Mapped[list] = mapped_column(JSON, default=list)

    # Rate limiting
    concurrent_requests: Mapped[int] = mapped_column(Integer, default=4)
    download_delay_seconds: Mapped[float] = mapped_column(default=2.0)

    # Proxy / user-agent overrides
    use_proxy: Mapped[bool] = mapped_column(Boolean, default=False)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)

    last_run_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_status: Mapped[str | None] = mapped_column(String(20), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
