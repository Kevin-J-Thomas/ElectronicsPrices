from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.models.listing import Listing
from app.models.price_history import PriceHistory

router = APIRouter(prefix="/listings", dependencies=[Depends(require_admin)])


@router.get("")
def list_listings(
    q: str | None = Query(default=None, description="Filter by title substring"),
    site: str | None = Query(default=None, description="Filter by site name"),
    condition: str | None = Query(default=None, description="new | used"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=5, le=200),
    db: Session = Depends(get_db),
):
    """Paginated admin view of every scraped listing with its latest price."""
    query = db.query(Listing)
    if q:
        for token in q.split():
            query = query.filter(Listing.title.ilike(f"%{token}%"))
    if site:
        query = query.filter(Listing.site == site)
    if condition:
        query = query.filter(Listing.condition == condition)

    total = query.count()
    rows = (
        query.order_by(desc(Listing.last_seen_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    # fetch latest price per listing in one query
    ids = [r.id for r in rows]
    latest_prices: dict[int, tuple[float, str, object]] = {}
    if ids:
        ph_rows = (
            db.query(PriceHistory.listing_id, PriceHistory.price, PriceHistory.currency, PriceHistory.scraped_at)
            .filter(PriceHistory.listing_id.in_(ids))
            .order_by(PriceHistory.listing_id, desc(PriceHistory.scraped_at))
            .all()
        )
        for listing_id, price, currency, scraped_at in ph_rows:
            if listing_id not in latest_prices:
                latest_prices[listing_id] = (price, currency, scraped_at)

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
        "items": [
            {
                "id": r.id,
                "site": r.site,
                "title": r.title,
                "url": r.url,
                "condition": r.condition,
                "seller": r.seller,
                "latitude": r.latitude,
                "longitude": r.longitude,
                "last_seen_at": r.last_seen_at.isoformat() if r.last_seen_at else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "latest_price": latest_prices.get(r.id, (None, None, None))[0],
                "currency": latest_prices.get(r.id, (None, None, None))[1],
                "price_scraped_at": (
                    latest_prices.get(r.id, (None, None, None))[2].isoformat()
                    if latest_prices.get(r.id, (None, None, None))[2]
                    else None
                ),
            }
            for r in rows
        ],
    }


@router.delete("/{listing_id}")
def delete_listing(listing_id: int, db: Session = Depends(get_db)):
    listing = db.get(Listing, listing_id)
    if listing:
        db.delete(listing)
        db.commit()
    return {"deleted": listing_id}
