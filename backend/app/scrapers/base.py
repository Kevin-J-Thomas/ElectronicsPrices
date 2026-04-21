from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy.orm import Session

from app.models import Listing, PriceHistory, Site


@dataclass
class ScrapedItem:
    """One product as scraped from a listing page."""

    title: str
    url: str
    price: float
    currency: str = "INR"
    condition: str = "new"  # new | used
    category: str | None = None
    seller: str | None = None
    latitude: float | None = None
    longitude: float | None = None


@dataclass
class ScrapeResult:
    items: list[ScrapedItem] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


class BaseScraper(ABC):
    """
    Base class for all site scrapers.

    Matches the signature required by the spec:
        Scraper(<Site>, [<categories>])
        Scraper(<Site>, [<categories>], (lat, lon, radius))   # location-based
    """

    def __init__(
        self,
        site: Site,
        categories: list[str] | None = None,
        location: tuple[float, float, float] | None = None,
    ):
        self.site = site
        self.categories = categories if categories is not None else (site.categories or [])
        self.location = location

    @abstractmethod
    def scrape(self) -> ScrapeResult:
        """Perform the scrape and return collected items."""
        ...

    def save(self, db: Session, result: ScrapeResult) -> dict:
        """Persist scraped items as listings + price_history rows. Idempotent on (site, url)."""
        items_new = 0
        items_updated = 0
        now = datetime.utcnow()

        for item in result.items:
            listing = (
                db.query(Listing)
                .filter(Listing.url == item.url)
                .first()
            )
            if listing is None:
                listing = Listing(
                    site=self.site.name,
                    url=item.url,
                    title=item.title,
                    condition=item.condition,
                    seller=item.seller,
                    latitude=item.latitude,
                    longitude=item.longitude,
                )
                db.add(listing)
                db.flush()
                items_new += 1
            else:
                listing.title = item.title
                listing.condition = item.condition
                listing.seller = item.seller
                listing.latitude = item.latitude
                listing.longitude = item.longitude
                listing.last_seen_at = now
                items_updated += 1

            db.add(
                PriceHistory(
                    listing_id=listing.id,
                    price=item.price,
                    currency=item.currency,
                )
            )

        db.commit()
        return {
            "items_scraped": len(result.items),
            "items_new": items_new,
            "items_updated": items_updated,
        }
