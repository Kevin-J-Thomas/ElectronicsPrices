from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class SiteBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    base_url: HttpUrl
    scraper_type: Literal["static", "shopify", "woocommerce", "dynamic", "api", "location"]
    enabled: bool = True
    requires_location: bool = False
    requires_auth: bool = False
    config: dict = {}
    categories: list[str] = []
    concurrent_requests: int = Field(default=4, ge=1, le=32)
    download_delay_seconds: float = Field(default=2.0, ge=0.0, le=60.0)
    use_proxy: bool = False
    user_agent: str | None = None


class SiteCreate(SiteBase):
    pass


class SiteUpdate(BaseModel):
    name: str | None = None
    base_url: HttpUrl | None = None
    scraper_type: Literal["static", "shopify", "woocommerce", "dynamic", "api", "location"] | None = None
    enabled: bool | None = None
    requires_location: bool | None = None
    requires_auth: bool | None = None
    config: dict | None = None
    categories: list[str] | None = None
    concurrent_requests: int | None = Field(default=None, ge=1, le=32)
    download_delay_seconds: float | None = Field(default=None, ge=0.0, le=60.0)
    use_proxy: bool | None = None
    user_agent: str | None = None


class SiteRead(SiteBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    base_url: str
    last_run_at: datetime | None = None
    last_status: str | None = None
    listings_count: int = 0
    created_at: datetime
    updated_at: datetime
