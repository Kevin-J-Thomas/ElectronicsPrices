from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.models.listing import Listing
from app.models.site import Site
from app.schemas.site import SiteCreate, SiteRead, SiteUpdate

router = APIRouter(prefix="/sites", dependencies=[Depends(require_admin)])


def _attach_listings_count(db: Session, sites: list[Site]) -> list[dict]:
    """Single GROUP BY to fetch listings count per site, then merge by name."""
    counts = dict(
        db.query(Listing.site, func.count(Listing.id))
        .group_by(Listing.site)
        .all()
    )
    out: list[dict] = []
    for s in sites:
        d = SiteRead.model_validate(s).model_dump(mode="json")
        d["listings_count"] = int(counts.get(s.name, 0))
        out.append(d)
    return out


@router.get("", response_model=list[SiteRead])
def list_sites(db: Session = Depends(get_db)):
    sites = db.query(Site).order_by(Site.name).all()
    return _attach_listings_count(db, sites)


@router.post("", response_model=SiteRead, status_code=status.HTTP_201_CREATED)
def create_site(payload: SiteCreate, db: Session = Depends(get_db)):
    if db.query(Site).filter(Site.name == payload.name).first():
        raise HTTPException(400, f"Site '{payload.name}' already exists")
    site = Site(**payload.model_dump(mode="json"))
    db.add(site)
    db.commit()
    db.refresh(site)
    return site


@router.get("/{site_id}", response_model=SiteRead)
def get_site(site_id: int, db: Session = Depends(get_db)):
    site = db.get(Site, site_id)
    if not site:
        raise HTTPException(404, "Site not found")
    return site


@router.patch("/{site_id}", response_model=SiteRead)
def update_site(site_id: int, payload: SiteUpdate, db: Session = Depends(get_db)):
    site = db.get(Site, site_id)
    if not site:
        raise HTTPException(404, "Site not found")
    data = payload.model_dump(exclude_unset=True, mode="json")
    for key, value in data.items():
        setattr(site, key, value)
    db.commit()
    db.refresh(site)
    return site


@router.delete("/{site_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_site(site_id: int, db: Session = Depends(get_db)):
    site = db.get(Site, site_id)
    if not site:
        raise HTTPException(404, "Site not found")
    db.delete(site)
    db.commit()


@router.post("/{site_id}/run", status_code=status.HTTP_202_ACCEPTED)
def trigger_run(site_id: int, db: Session = Depends(get_db)):
    """Manually enqueue a scrape for this site via Celery."""
    from app.tasks.scrape import run_site_scrape

    site = db.get(Site, site_id)
    if not site:
        raise HTTPException(404, "Site not found")
    if not site.enabled:
        raise HTTPException(
            409,
            f"Site '{site.name}' is paused"
            + (f" ({site.last_status})" if site.last_status else "")
            + " — enable it from the site settings before triggering a scrape.",
        )
    task = run_site_scrape.delay(site_id)
    return {"status": "queued", "site_id": site_id, "task_id": task.id}
