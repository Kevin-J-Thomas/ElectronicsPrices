from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.listing import Listing
from app.models.price_history import PriceHistory
from app.models.scrape_run import ScrapeRun
from app.models.site import Site
from app.services.search import (
    compute_order_total,
    coverage_for_orderlist,
    search_listings,
)

router = APIRouter(prefix="", tags=["public"])


@router.get("/search")
def search(
    q: str = Query(..., min_length=1, description="Product search query"),
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
):
    """Search listings across all sites. Returns cheapest-first with 5-point score."""
    return {"query": q, "results": search_listings(db, q, limit=limit)}


class OrderListIn(BaseModel):
    items: list[str]


@router.post("/orders/lowest-cost")
def orders_lowest_cost(payload: OrderListIn, db: Session = Depends(get_db)):
    """Pick the overall cheapest listing per item, return total cost."""
    if not payload.items:
        raise HTTPException(400, "items cannot be empty")
    return compute_order_total(db, payload.items)


@router.post("/orders/coverage")
def orders_coverage(payload: OrderListIn, db: Session = Depends(get_db)):
    """
    For each item, return every site that stocks it with price + link + score.
    Matches the spec's 'expected results' format.
    """
    if not payload.items:
        raise HTTPException(400, "items cannot be empty")
    return coverage_for_orderlist(db, payload.items)


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    """Dashboard summary stats."""
    return {
        "total_sites": db.query(Site).count(),
        "enabled_sites": db.query(Site).filter(Site.enabled.is_(True)).count(),
        "total_listings": db.query(Listing).count(),
        "total_price_points": db.query(PriceHistory).count(),
        "recent_runs_24h": (
            db.query(ScrapeRun)
            .filter(ScrapeRun.started_at >= datetime.utcnow() - timedelta(days=1))
            .count()
        ),
    }


@router.get("/prices/timeseries")
def price_timeseries(
    limit_products: int = Query(default=8, le=20),
    days: int = Query(default=14, le=90),
    db: Session = Depends(get_db),
):
    """
    For the N most recently-scraped listings, return their price history.
    Used by the homepage timeseries chart.
    """
    cutoff = datetime.utcnow() - timedelta(days=days)

    latest = (
        db.query(Listing.id, Listing.title, Listing.site)
        .join(PriceHistory, PriceHistory.listing_id == Listing.id)
        .filter(PriceHistory.scraped_at >= cutoff)
        .group_by(Listing.id, Listing.title, Listing.site)
        .order_by(func.max(PriceHistory.scraped_at).desc())
        .limit(limit_products)
        .all()
    )

    series = []
    for listing_id, title, site in latest:
        history = (
            db.query(PriceHistory.scraped_at, PriceHistory.price)
            .filter(
                PriceHistory.listing_id == listing_id,
                PriceHistory.scraped_at >= cutoff,
            )
            .order_by(PriceHistory.scraped_at.asc())
            .all()
        )
        series.append({
            "listing_id": listing_id,
            "title": title,
            "site": site,
            "points": [
                {"t": t.isoformat(), "price": float(p)} for t, p in history
            ],
        })
    return {"series": series}


@router.get("/sites/public")
def public_sites(db: Session = Depends(get_db)):
    """List sites (no secrets) — for dashboard filters."""
    return [
        {"id": s.id, "name": s.name, "scraper_type": s.scraper_type,
         "enabled": s.enabled, "last_status": s.last_status}
        for s in db.query(Site).order_by(Site.name).all()
    ]
