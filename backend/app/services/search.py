"""Search + coverage logic for listings."""
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.models.listing import Listing
from app.models.price_history import PriceHistory
from app.services.scoring import score_price


def _latest_price_subquery(db: Session):
    """Subquery: latest scraped_at per listing."""
    return (
        db.query(
            PriceHistory.listing_id,
            func.max(PriceHistory.scraped_at).label("max_scraped"),
        )
        .group_by(PriceHistory.listing_id)
        .subquery()
    )


def search_listings(db: Session, query: str, limit: int = 50) -> list[dict]:
    """Return listings whose title contains the query, with latest price & score."""
    q = query.strip()
    if not q:
        return []

    # AND every word token → match "samsung ssd" against "Samsung 980 SSD ..."
    tokens = [t for t in q.split() if t]
    if not tokens:
        return []
    conditions = and_(*[Listing.title.ilike(f"%{t}%") for t in tokens])

    sub = _latest_price_subquery(db)
    rows = (
        db.query(Listing, PriceHistory)
        .join(sub, sub.c.listing_id == Listing.id)
        .join(
            PriceHistory,
            (PriceHistory.listing_id == Listing.id)
            & (PriceHistory.scraped_at == sub.c.max_scraped),
        )
        .filter(conditions)
        .order_by(PriceHistory.price.asc())
        .limit(limit)
        .all()
    )

    peer_prices = [float(p.price) for _, p in rows]

    results = []
    for listing, price in rows:
        results.append({
            "listing_id": listing.id,
            "title": listing.title,
            "site": listing.site,
            "url": listing.url,
            "condition": listing.condition,
            "price": float(price.price),
            "currency": price.currency,
            "score": score_price(float(price.price), peer_prices),
            "scraped_at": price.scraped_at.isoformat() if price.scraped_at else None,
        })
    return results


def cheapest_per_site(db: Session, query: str) -> dict:
    """For a single item query, return the cheapest listing per site."""
    matches = search_listings(db, query, limit=200)
    per_site: dict[str, dict] = {}
    for m in matches:
        existing = per_site.get(m["site"])
        if existing is None or m["price"] < existing["price"]:
            per_site[m["site"]] = m
    return per_site


def coverage_for_orderlist(db: Session, queries: list[str]) -> dict:
    """
    For each query string, return {site: {price, link, score, condition}}.
    Matches the spec's expected evaluation format.
    """
    result: dict[str, dict] = {}
    for q in queries:
        per_site = cheapest_per_site(db, q)
        result[q] = {
            site: {
                "price": m["price"],
                "currency": m["currency"],
                "link": m["url"],
                "title": m["title"],
                "score": m["score"],
                "condition": m["condition"],
            }
            for site, m in per_site.items()
        }
    return result


def compute_order_total(db: Session, queries: list[str]) -> dict:
    """
    Pick the overall cheapest listing per item, sum to a total.
    Returns: {items: [{query, chosen_site, price, link}], total: ..., missing: [...]}
    """
    items = []
    missing = []
    total = 0.0
    for q in queries:
        best = search_listings(db, q, limit=1)
        if not best:
            missing.append(q)
            continue
        b = best[0]
        items.append({
            "query": q,
            "chosen_site": b["site"],
            "title": b["title"],
            "price": b["price"],
            "currency": b["currency"],
            "link": b["url"],
            "score": b["score"],
        })
        total += b["price"]
    return {
        "items": items,
        "total": total,
        "currency": items[0]["currency"] if items else "INR",
        "missing": missing,
    }
