from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.models.listing import Listing
from app.models.product import Product
from app.services.grouping import group_listings, regroup_all

router = APIRouter(prefix="/grouping", dependencies=[Depends(require_admin)])


@router.get("/stats")
def grouping_stats(db: Session = Depends(get_db)):
    total_listings = db.query(Listing).count()
    grouped = db.query(Listing).filter(Listing.product_id.isnot(None)).count()
    total_products = db.query(Product).count()
    multi_site_products = (
        db.query(Listing.product_id)
        .filter(Listing.product_id.isnot(None))
        .group_by(Listing.product_id)
        .having(func.count(func.distinct(Listing.site)) > 1)
        .count()
    )
    return {
        "total_listings": total_listings,
        "grouped_listings": grouped,
        "ungrouped_listings": total_listings - grouped,
        "total_products": total_products,
        "multi_site_products": multi_site_products,
        "coverage_pct": round(grouped / total_listings * 100, 1) if total_listings else 0,
    }


@router.post("/run")
def run_grouping(
    threshold: int = Query(default=85, ge=60, le=100),
    db: Session = Depends(get_db),
):
    """Group any unlinked listings. Idempotent."""
    return group_listings(db, threshold=threshold)


@router.post("/reset")
def reset_grouping(
    threshold: int = Query(default=85, ge=60, le=100),
    db: Session = Depends(get_db),
):
    """Nuclear reset — wipe all product links and rebuild from scratch."""
    return regroup_all(db, threshold=threshold)


@router.get("/products")
def list_products(
    multi_site: bool = Query(default=False, description="Only products with listings on ≥2 sites"),
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Browse the grouped products with site counts."""
    q = (
        db.query(
            Product.id,
            Product.canonical_name,
            Product.brand,
            Product.model,
            func.count(Listing.id).label("listing_count"),
            func.count(func.distinct(Listing.site)).label("site_count"),
            func.min(Listing.last_seen_at).label("first_seen"),
        )
        .join(Listing, Listing.product_id == Product.id)
        .group_by(Product.id)
    )
    if multi_site:
        q = q.having(func.count(func.distinct(Listing.site)) > 1)
    q = q.order_by(func.count(Listing.id).desc()).limit(limit)
    return [
        {
            "id": pid,
            "canonical_name": name,
            "brand": brand,
            "model": model,
            "listing_count": lc,
            "site_count": sc,
        }
        for pid, name, brand, model, lc, sc, _fs in q.all()
    ]
