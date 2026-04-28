from celery import Celery
from celery.signals import worker_process_init

from app.core.config import settings

celery_app = Celery(
    "electronics_inventory",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks.scrape"],
)


@worker_process_init.connect
def reset_db_pool_on_fork(**_kwargs):
    """Each forked Celery worker gets a fresh SQLAlchemy connection pool.

    Without this, child workers inherit the parent's open connections and the
    SQLAlchemy result-row keymap can desynchronise between processes — surfacing
    as `KeyError: Column('id', ...)` / "Could not locate column in row for column
    'sites.id'" errors mid-scrape.
    """
    from app.db.session import engine
    engine.dispose(close=False)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Kolkata",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 min hard limit per scrape
    task_soft_time_limit=25 * 60,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    broker_connection_retry_on_startup=True,
)


@celery_app.on_after_configure.connect
def setup_periodic_tasks(sender, **_kwargs):
    from app.core.beat_schedule import load_beat_schedule

    for name, entry in load_beat_schedule().items():
        sender.add_periodic_task(entry["schedule"], sender.tasks[entry["task"]].s(*entry["args"]), name=name)
