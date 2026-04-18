from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ScheduleJobBase(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    site_id: int | None = None  # null = all enabled sites
    cron_expression: str = Field(min_length=1, max_length=50)
    timezone: str = "Asia/Kolkata"
    enabled: bool = True


class ScheduleJobCreate(ScheduleJobBase):
    pass


class ScheduleJobUpdate(BaseModel):
    name: str | None = None
    site_id: int | None = None
    cron_expression: str | None = None
    timezone: str | None = None
    enabled: bool | None = None


class ScheduleJobRead(ScheduleJobBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    last_run_at: datetime | None = None
    next_run_at: datetime | None = None
    last_status: str | None = None
    created_at: datetime
    updated_at: datetime
