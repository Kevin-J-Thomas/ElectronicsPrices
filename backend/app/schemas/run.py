from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ScrapeRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    site_id: int
    job_id: int | None
    status: str
    started_at: datetime
    finished_at: datetime | None
    items_scraped: int
    items_new: int
    items_updated: int
    error_message: str | None
