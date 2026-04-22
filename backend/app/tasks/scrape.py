import logging
from datetime import datetime

from app.core.celery_app import celery_app
from app.db.session import SessionLocal
from app.models.scrape_run import ScrapeRun
from app.models.site import Site
from app.scrapers.registry import ScraperNotImplemented, get_scraper

log = logging.getLogger(__name__)


@celery_app.task(bind=True, name="scrape.run_site")
def run_site_scrape(self, site_id: int, job_id: int | None = None) -> dict:
    """Run a scrape for a single site. Records a ScrapeRun row."""
    db = SessionLocal()
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

    try:
        site = db.get(Site, site_id)
        if not site:
            finish("failed", error_message=f"Site {site_id} not found")
            return {"status": "failed", "reason": "not_found"}
        if not site.enabled:
            finish("failed", error_message="Site is disabled")
            return {"status": "skipped", "reason": "disabled"}

        log.info("Scraping %s (id=%s, type=%s)", site.name, site.id, site.scraper_type)

        try:
            scraper = get_scraper(site)
        except ScraperNotImplemented as exc:
            finish("failed", error_message=str(exc))
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

        log_output = None
        if result.errors:
            log_output = "\n".join(result.errors[:100])
            log.warning("Scrape of %s had %d errors", site.name, len(result.errors))

        final_status = "success" if stats["items_scraped"] > 0 else "success"
        finish(
            final_status,
            items_scraped=stats["items_scraped"],
            items_new=stats["items_new"],
            items_updated=stats["items_updated"],
            log_output=log_output,
        )
        site.last_run_at = run.finished_at
        site.last_status = final_status
        db.commit()

        return {"status": "success", "site": site.name, **stats}

    except Exception as exc:
        log.exception("Scrape failed for site_id=%s", site_id)
        finish("failed", error_message=str(exc)[:2000])
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
