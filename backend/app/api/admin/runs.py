from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.models.scrape_run import ScrapeRun
from app.models.site import Site
from app.schemas.run import ScrapeRunDetail, ScrapeRunRead

router = APIRouter(prefix="/runs", dependencies=[Depends(require_admin)])


@router.get("", response_model=list[ScrapeRunRead])
def list_runs(
    site_id: int | None = None,
    status: str | None = None,
    limit: int = Query(default=50, le=500),
    db: Session = Depends(get_db),
):
    query = db.query(ScrapeRun)
    if site_id:
        query = query.filter(ScrapeRun.site_id == site_id)
    if status:
        query = query.filter(ScrapeRun.status == status)
    return query.order_by(ScrapeRun.started_at.desc()).limit(limit).all()


@router.get("/{run_id}", response_model=ScrapeRunDetail)
def get_run(run_id: int, db: Session = Depends(get_db)):
    """Single run with full log output and resolved site name."""
    run = db.get(ScrapeRun, run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    site = db.get(Site, run.site_id)
    return ScrapeRunDetail(
        id=run.id,
        site_id=run.site_id,
        job_id=run.job_id,
        status=run.status,
        started_at=run.started_at,
        finished_at=run.finished_at,
        items_scraped=run.items_scraped,
        items_new=run.items_new,
        items_updated=run.items_updated,
        error_message=run.error_message,
        log_output=run.log_output,
        site_name=site.name if site else None,
    )
