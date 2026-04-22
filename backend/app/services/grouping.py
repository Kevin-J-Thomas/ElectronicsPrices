"""Product grouping — cluster listings across sites into canonical Products.

Spec requirement: when the same product appears on multiple marketplaces, group
them so the 5-point score compares like-for-like prices, not random same-word
listings.

Strategy:
    1. Normalize each listing's title (lowercase, strip noise words/punct).
    2. Fuzzy-match against existing Products (token_set_ratio ≥ threshold).
    3. If no match, create a new Product and attach this listing.
    4. Idempotent on Listing.product_id — safe to re-run.
"""

import re
from typing import Any

from rapidfuzz import fuzz, process
from sqlalchemy.orm import Session

from app.models.listing import Listing
from app.models.product import Product

# Common marketplace noise — stripped before comparing
STOPWORDS: set[str] = {
    "with", "for", "from", "the", "and", "new", "brand", "genuine", "original",
    "sealed", "buy", "online", "free", "shipping", "delivery", "warranty",
    "india", "indian", "pack", "of", "combo", "latest", "model", "edition",
    "version", "available", "in", "stock", "best", "price",
}

# Keep hyphens/slashes inside model numbers (e.g. "980-pro", "970/evo")
_KEEP = re.compile(r"[^a-z0-9\s\-/]")
_PARENS = re.compile(r"\([^)]*\)|\[[^\]]*\]")


def normalize_title(title: str) -> str:
    """Canonical lowercase token string used for fuzzy comparison."""
    if not title:
        return ""
    t = title.lower()
    t = _PARENS.sub(" ", t)
    t = _KEEP.sub(" ", t)
    tokens = [w for w in t.split() if w not in STOPWORDS and len(w) > 1]
    return " ".join(tokens)


def extract_brand_model(normalized: str) -> tuple[str | None, str | None]:
    """Heuristic: first token is brand, first alphanumeric-with-digits is model."""
    parts = normalized.split()
    if not parts:
        return None, None
    brand = parts[0]
    for p in parts[1:]:
        if any(c.isdigit() for c in p) and len(p) >= 3:
            return brand, p
    return brand, None


def group_listings(db: Session, threshold: int = 85) -> dict[str, Any]:
    """Assign every unlinked Listing to a Product (existing or new).

    Args:
        db: Session.
        threshold: token_set_ratio score above which listings are considered
            the same product. 85 is conservative (few false positives).

    Returns:
        Stats dict with counts.
    """
    products = db.query(Product).all()
    product_index: dict[str, Product] = {p.normalized_name: p for p in products}
    product_names: list[str] = list(product_index.keys())

    unlinked = db.query(Listing).filter(Listing.product_id.is_(None)).all()

    assigned = 0
    created = 0
    skipped = 0

    for listing in unlinked:
        normalized = normalize_title(listing.title)
        if not normalized or len(normalized) < 3:
            skipped += 1
            continue

        matched_pid: int | None = None
        if product_names:
            match = process.extractOne(
                normalized,
                product_names,
                scorer=fuzz.token_set_ratio,
                score_cutoff=threshold,
            )
            if match:
                name, _score, _idx = match
                matched_pid = product_index[name].id

        if matched_pid is not None:
            listing.product_id = matched_pid
            assigned += 1
        else:
            brand, model = extract_brand_model(normalized)
            new_prod = Product(
                canonical_name=listing.title[:255],
                normalized_name=normalized[:255],
                category="uncategorized",
                brand=brand,
                model=model,
            )
            db.add(new_prod)
            db.flush()
            listing.product_id = new_prod.id
            product_index[normalized] = new_prod
            product_names.append(normalized)
            created += 1

    db.commit()
    return {
        "processed": len(unlinked),
        "assigned_existing": assigned,
        "created_products": created,
        "skipped": skipped,
        "total_products": len(product_names),
    }


def regroup_all(db: Session, threshold: int = 85) -> dict[str, Any]:
    """Nuclear reset — clear every product_id, delete all Products, rebuild."""
    db.query(Listing).update({Listing.product_id: None}, synchronize_session=False)
    db.query(Product).delete(synchronize_session=False)
    db.commit()
    return group_listings(db, threshold)
