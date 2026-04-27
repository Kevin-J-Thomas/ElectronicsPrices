import io
import logging
import traceback
from contextlib import contextmanager
from datetime import datetime

from app.core.celery_app import celery_app
from app.db.session import SessionLocal
from app.models.scrape_run import ScrapeRun
from app.models.site import Site
from app.scrapers.registry import ScraperNotImplemented, get_scraper

log = logging.getLogger(__name__)

LOG_OUTPUT_MAX_BYTES = 64 * 1024  # 64KB cap per run


@contextmanager
def capture_run_logs():
    """Capture all log records emitted on the `app` logger tree into a buffer.

    Yields a callable returning the buffered text so far. The handler is
    detached and the stream closed on exit.
    """
    buffer = io.StringIO()
    handler = logging.StreamHandler(buffer)
    handler.setLevel(logging.DEBUG)
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)-7s %(name)s — %(message)s",
                          datefmt="%H:%M:%S")
    )
    target = logging.getLogger("app")
    prev_level = target.level
    if prev_level > logging.DEBUG or prev_level == logging.NOTSET:
        target.setLevel(logging.DEBUG)
    target.addHandler(handler)
    try:
        yield lambda: buffer.getvalue()
    finally:
        target.removeHandler(handler)
        target.setLevel(prev_level)
        handler.close()


def _truncate(text: str, limit: int = LOG_OUTPUT_MAX_BYTES) -> str:
    if len(text) <= limit:
        return text
    head = limit // 2
    tail = limit - head - 80
    return text[:head] + f"\n\n…[truncated {len(text) - limit} bytes]…\n\n" + text[-tail:]


@celery_app.task(bind=True, name="scrape.run_site")
def run_site_scrape(
    self,
    site_id: int,
    job_id: int | None = None,
    run_id: int | None = None,
) -> dict:
    """Run a scrape for a single site. Records a ScrapeRun row.

    If run_id is provided, uses that pre-created row instead of creating one.
    This lets callers (e.g. /search/scan) surface progress via stable IDs.
    """
    db = SessionLocal()
    run: ScrapeRun | None = None
    if run_id is not None:
        run = db.get(ScrapeRun, run_id)
    if run is None:
        run = ScrapeRun(site_id=site_id, job_id=job_id, status="running")
        db.add(run)
        db.commit()
        db.refresh(run)

    def finish(status: str, **fields) -> None:
        run.status = status
        run.finished_at = datetime.utcnow()
        for k, v in fields.items():
            setattr(run, k, v)
        db.commit()

    with capture_run_logs() as get_logs:
        try:
            site = db.get(Site, site_id)
            if not site:
                finish("failed", error_message=f"Site {site_id} not found",
                       log_output=_truncate(get_logs()))
                return {"status": "failed", "reason": "not_found"}
            if not site.enabled:
                finish("failed", error_message="Site is disabled",
                       log_output=_truncate(get_logs()))
                return {"status": "skipped", "reason": "disabled"}

            log.info("Scraping %s (id=%s, type=%s)", site.name, site.id, site.scraper_type)

            try:
                scraper = get_scraper(site)
            except ScraperNotImplemented as exc:
                finish("failed", error_message=str(exc), log_output=_truncate(get_logs()))
                site.last_status = "failed"
                db.commit()
                return {"status": "failed", "reason": "not_implemented"}

            result = scraper.scrape()
            stats = scraper.save(db, result)

            # Auto-group newly scraped listings into canonical Products
            try:
                from app.services.grouping import group_listings
                group_listings(db)
            except Exception:
                log.exception("Auto-grouping failed after scrape of %s", site.name)

            if result.errors:
                log.warning("Scrape of %s had %d parser errors", site.name, len(result.errors))
                for err in result.errors[:100]:
                    log.warning("parser-error: %s", err)

            # Distinguish "no config / no-op" from "real success".
            # If the scraper produced no items AND every error is a config-precondition
            # message, the run did nothing meaningful — mark it skipped so the
            # admin can spot unconfigured sites at a glance.
            unconfigured_markers = ("no scraper config", "missing selector keys")
            no_items = stats["items_scraped"] == 0 and stats["items_new"] == 0
            all_config_errors = bool(result.errors) and all(
                any(m in e.lower() for m in unconfigured_markers) for e in result.errors
            )
            if no_items and all_config_errors:
                final_status = "skipped"
                error_msg = result.errors[0][:2000]
            else:
                final_status = "success"
                error_msg = None

            finish(
                final_status,
                items_scraped=stats["items_scraped"],
                items_new=stats["items_new"],
                items_updated=stats["items_updated"],
                log_output=_truncate(get_logs()),
                error_message=error_msg,
            )
            site.last_run_at = run.finished_at
            site.last_status = final_status
            db.commit()

            return {"status": final_status, "site": site.name, **stats}

        except Exception as exc:
            log.exception("Scrape failed for site_id=%s", site_id)
            tb = traceback.format_exc()
            combined = (get_logs() or "") + "\n\n=== TRACEBACK ===\n" + tb
            finish(
                "failed",
                error_message=str(exc)[:2000],
                log_output=_truncate(combined),
            )
            try:
                site = db.get(Site, site_id)
                if site:
                    site.last_status = "failed"
                    db.commit()
            except Exception:
                pass
            return {"status": "failed", "error": str(exc)[:200]}

        finally:
            db.close()


@celery_app.task(name="scrape.run_all_enabled")
def run_all_enabled_sites() -> dict:
    """Enqueue scrapes for every enabled site. Called by Beat on a schedule."""
    db = SessionLocal()
    try:
        sites = db.query(Site).filter(Site.enabled.is_(True)).all()
        for site in sites:
            run_site_scrape.delay(site.id)
        return {"queued": len(sites), "sites": [s.name for s in sites]}
    finally:
        db.close()
