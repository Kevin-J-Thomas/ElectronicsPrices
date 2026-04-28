from app.models import Site
from app.scrapers.base import BaseScraper
from app.scrapers.shopify import ShopifyScraper
from app.scrapers.static import StaticHtmlScraper
from app.scrapers.woocommerce import WooCommerceScraper


class ScraperNotImplemented(Exception):
    pass


def get_scraper(
    site: Site,
    categories: list[str] | None = None,
    location: tuple[float, float, float] | None = None,
) -> BaseScraper:
    """Dispatch to the right scraper class based on Site.scraper_type."""
    kind = site.scraper_type

    if kind == "static":
        return StaticHtmlScraper(site, categories=categories, location=location)

    if kind == "shopify":
        return ShopifyScraper(site, categories=categories, location=location)

    if kind == "woocommerce":
        return WooCommerceScraper(site, categories=categories, location=location)

    if kind == "dynamic":
        # Lazy import so Playwright isn't loaded for static-only workers
        from app.scrapers.dynamic import DynamicHtmlScraper
        return DynamicHtmlScraper(site, categories=categories, location=location)

    if kind == "api":
        raise ScraperNotImplemented(
            "API-based scraper not yet implemented — used for sites with JSON APIs (OLX)"
        )

    if kind == "location":
        raise ScraperNotImplemented(
            "Location-based scraper not yet implemented — used for OLX / FB Marketplace"
        )

    raise ValueError(f"Unknown scraper_type: {kind!r}")
