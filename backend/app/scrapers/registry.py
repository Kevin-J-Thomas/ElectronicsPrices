from app.models import Site
from app.scrapers.base import BaseScraper
from app.scrapers.olx import OLXScraper
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
        name = (site.name or "").lower()
        url = (site.base_url or "").lower()
        if name == "amazon" or "amazon.in" in url:
            from app.scrapers.amazon import AmazonScraper
            return AmazonScraper(site, categories=categories, location=location)
        if name == "modxcomputers" or "modxcomputers.com" in url:
            from app.scrapers.modx import ModxScraper
            return ModxScraper(site, categories=categories, location=location)
        if name == "computech" or "computechstore.in" in url:
            from app.scrapers.computech import ComputechScraper
            return ComputechScraper(site, categories=categories, location=location)
        if name == "fusiongaming" or "fusiongaming.in" in url:
            from app.scrapers.fusiongaming import FusionGamingScraper
            return FusionGamingScraper(site, categories=categories, location=location)
        raise ScraperNotImplemented(
            f"API scraper for '{site.name}' not implemented"
        )

    if kind == "location":
        name = (site.name or "").lower()
        url = (site.base_url or "").lower()
        if name == "olx":
            return OLXScraper(site, categories=categories, location=location)
        if "facebook" in name or "facebook.com" in url:
            from app.scrapers.facebook import FacebookMarketplaceScraper
            return FacebookMarketplaceScraper(site, categories=categories, location=location)
        raise ScraperNotImplemented(
            f"Location scraper for '{site.name}' not implemented"
        )

    raise ValueError(f"Unknown scraper_type: {kind!r}")
