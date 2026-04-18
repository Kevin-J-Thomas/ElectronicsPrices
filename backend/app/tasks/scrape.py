from datetime import datetime

from app.core.celery_app import celery_app
from app.db.session import SessionLocal
from app.models.scrape_run import ScrapeRun
from app.models.site import Site


@celery_app.task(bind=True, name="scrape.run_site", max_retries=3, default_retry_delay=60)
def run_site_scrape(self, site_id: int, job_id: int | None = None) -> dict:
    """Run a scrape for a single site. Records a ScrapeRun row."""
    db = SessionLocal()
    run = ScrapeRun(site_id=site_id, job_id=job_id, status="running")
    db.add(run)
    db.commit()
    db.refresh(run)

    try:
        site = db.get(Site, site_id)
        if not site or not site.enabled:
            run.status = "failed"
            run.error_message = "Site missing or disabled"
            run.finished_at = datetime.utcnow()
            db.commit()
            return {"status": "skipped", "site_id": site_id}

        # TODO: dispatch to Scraper subclass based on site.scraper_type
        # from app.scrapers.registry import get_scraper
        # scraper = get_scraper(site)
        # result = scraper.run()

        run.status = "success"
        run.items_scraped = 0
        run.finished_at = datetime.utcnow()
        site.last_run_at = run.finished_at
        site.last_status = "success"
        db.commit()
        return {"status": "success", "site_id": site_id, "run_id": run.id}

    except Exception as exc:
        run.status = "failed"
        run.error_message = str(exc)
        run.finished_at = datetime.utcnow()
        db.commit()
        raise self.retry(exc=exc)
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
        return {"queued": len(sites)}
    finally:
        db.close()
