from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.models.scrape_run import ScrapeRun
from app.schemas.run import ScrapeRunRead

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
