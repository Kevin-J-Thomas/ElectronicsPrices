"""Dynamic Celery Beat schedule loaded from the schedule_jobs table.

Beat calls `beat_schedule_loader()` on start to build its schedule.
When jobs are added/edited in the admin UI, restart beat to pick up changes.
(For hot-reload, swap for celery-sqlalchemy-scheduler or redbeat later.)
"""
from celery.schedules import crontab

from app.db.session import SessionLocal
from app.models.schedule_job import ScheduleJob


def _parse_cron(expr: str) -> crontab:
    """Convert '0 6 * * *' → celery crontab(minute=0, hour=6, ...)."""
    parts = expr.strip().split()
    if len(parts) != 5:
        raise ValueError(f"Invalid cron: {expr!r}")
    minute, hour, day_of_month, month_of_year, day_of_week = parts
    return crontab(
        minute=minute,
        hour=hour,
        day_of_month=day_of_month,
        month_of_year=month_of_year,
        day_of_week=day_of_week,
    )


def load_beat_schedule() -> dict:
    """Build Celery beat_schedule dict from DB."""
    db = SessionLocal()
    try:
        schedule: dict = {}
        for job in db.query(ScheduleJob).filter(ScheduleJob.enabled.is_(True)).all():
            task_name = "scrape.run_site" if job.site_id else "scrape.run_all_enabled"
            args = [job.site_id] if job.site_id else []
            schedule[f"job_{job.id}_{job.name}"] = {
                "task": task_name,
                "schedule": _parse_cron(job.cron_expression),
                "args": args,
            }
        return schedule
    finally:
        db.close()
