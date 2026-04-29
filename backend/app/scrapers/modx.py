"""Scraper for ModxComputers (modxcomputers.com).

The Next.js storefront is backed by a custom Express/Mongo API at
``https://api.modxcomputers.com``. The product list endpoint returns clean,
paginated JSON with all the fields we need:

    GET /api/products?page=1&limit=200
    -> { success: true, data: [...], total: <int>, count: <int> }

Each product has ``name``, ``slug``, ``price``, ``priceSale``, ``image``.
The storefront URL is ``https://modxcomputers.com/product/<slug>``.

Site.config schema (all optional):
    {
        "per_page": 200,           # items per API page (the API will cap if too high)
        "max_pages": 20,           # safety cap; stops earlier when 'total' is reached
        "request_timeout": 25
    }
"""
from __future__ import annotations

import logging
from urllib.parse import urljoin

import requests

from app.scrapers.base import BaseScraper, ScrapedItem, ScrapeResult

log = logging.getLogger(__name__)

DEFAULT_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/121.0 Safari/537.36"
)
API_BASE = "https://api.modxcomputers.com"


class ModxScraper(BaseScraper):
    def scrape(self) -> ScrapeResult:
        result = ScrapeResult()
        config = self.site.config or {}
        per_page = int(config.get("per_page", 200))
        max_pages = int(config.get("max_pages", 20))
        timeout = int(config.get("request_timeout", 25))

        headers = {
            "User-Agent": self.site.user_agent or DEFAULT_UA,
            "Accept": "application/json",
            "Origin": self.site.base_url.rstrip("/"),
            "Referer": self.site.base_url.rstrip("/") + "/",
        }
        seen_urls: set[str] = set()
        total: int | None = None

        for page in range(1, max_pages + 1):
            url = f"{API_BASE}/api/products?page={page}&limit={per_page}"
            try:
                resp = requests.get(url, headers=headers, timeout=timeout)
            except requests.RequestException as exc:
                result.errors.append(f"{url}: {exc}")
                break

            if resp.status_code >= 400:
                result.errors.append(f"{url}: HTTP {resp.status_code}")
                break

            try:
                payload = resp.json()
            except ValueError:
                result.errors.append(f"{url}: invalid JSON")
                break

            data = payload.get("data") or []
            if not data:
                break
            if total is None:
                total = int(payload.get("total") or 0)
                log.info("Modx scrape: total=%d", total)

            page_added = 0
            for prod in data:
                item = self._parse_product(prod)
                if item and item.url not in seen_urls:
                    seen_urls.add(item.url)
                    result.items.append(item)
                    page_added += 1

            log.info(
                "Modx scrape: page=%d got=%d added=%d running=%d",
                page, len(data), page_added, len(result.items),
            )

            # Stop when we've drained the catalog.
            if total and len(seen_urls) >= total:
                break
            if len(data) < per_page:
                break

        log.info(
            "Modx scrape: %s — %d unique items, %d errors",
            self.site.name, len(result.items), len(result.errors),
        )
        return result

    def _parse_product(self, prod: dict) -> ScrapedItem | None:
        name = (prod.get("name") or "").strip()
        slug = prod.get("slug")
        if not name or not slug:
            return None

        # Prefer sale price if positive, else regular price
        price = None
        for key in ("priceSale", "price", "regularPrice"):
            val = prod.get(key)
            if val is None:
                continue
            try:
                p = float(val)
            except (TypeError, ValueError):
                continue
            if p > 0:
                price = p
                break
        if price is None:
            return None

        product_url = urljoin(
            self.site.base_url.rstrip("/") + "/", f"product/{slug}",
        )

        return ScrapedItem(
            title=name,
            url=product_url,
            price=price,
            currency="INR",
            condition="new",
        )
