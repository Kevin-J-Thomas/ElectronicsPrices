"""Scraper for Shopify-based stores using the public products.json endpoint.

Every Shopify storefront exposes:
    /collections/<handle>/products.json?limit=N&page=P

…which returns clean JSON with title, handle, vendor, product_type, variants[].price.
This is dramatically more reliable than HTML scraping (no selectors to maintain,
no JS rendering needed). Most Indian PC stores run on Shopify.

Site.config schema:
    {
        "category_handles": {
            "processor": "processor",
            "ram": "ram",
            "graphics-card": "graphic-cards",
            "storage": "ssd",
            "motherboard": "motherboard",
            "power-supply": "power-supply-unit-psu"
        },
        "per_page": 50,                 # max 250 (Shopify limit)
        "max_pages": 5,
        "request_timeout": 20            # seconds
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


class ShopifyScraper(BaseScraper):
    def scrape(self) -> ScrapeResult:
        result = ScrapeResult()
        config = self.site.config or {}
        handles: dict[str, str] = config.get("category_handles") or {}
        per_page = min(int(config.get("per_page", 50)), 250)
        max_pages = int(config.get("max_pages", 5))
        timeout = int(config.get("request_timeout", 20))

        if not handles:
            result.errors.append(
                f"Site '{self.site.name}' has no shopify category_handles configured — "
                "set 'category_handles' in the admin panel"
            )
            return result

        target_categories = self.categories or list(handles.keys())
        headers = {"User-Agent": self.site.user_agent or DEFAULT_UA, "Accept": "application/json"}
        seen_urls: set[str] = set()

        for category in target_categories:
            handle = handles.get(category) or category
            log.info("Shopify scrape: %s / %s", self.site.name, handle)
            page_count = 0
            for page in range(1, max_pages + 1):
                url = urljoin(
                    self.site.base_url.rstrip("/") + "/",
                    f"collections/{handle}/products.json?limit={per_page}&page={page}",
                )
                try:
                    resp = requests.get(url, headers=headers, timeout=timeout)
                except requests.RequestException as exc:
                    result.errors.append(f"{url}: {exc}")
                    break

                if resp.status_code == 404:
                    result.errors.append(
                        f"{url}: 404 — collection handle '{handle}' not found"
                    )
                    break
                if resp.status_code >= 400:
                    result.errors.append(f"{url}: HTTP {resp.status_code}")
                    break

                try:
                    payload = resp.json()
                except ValueError:
                    result.errors.append(f"{url}: invalid JSON response")
                    break

                products = payload.get("products") or []
                if not products:
                    break  # no more pages
                page_count += 1

                for prod in products:
                    item = self._parse_product(prod, category)
                    if item and item.url not in seen_urls:
                        seen_urls.add(item.url)
                        result.items.append(item)

                if len(products) < per_page:
                    break  # last page reached

            log.info(
                "Shopify scrape: %s / %s — %d page(s) processed",
                self.site.name, handle, page_count,
            )

        log.info(
            "Shopify scrape: %s — %d unique items, %d errors",
            self.site.name, len(result.items), len(result.errors),
        )
        return result

    def _parse_product(self, prod: dict, category: str) -> ScrapedItem | None:
        title = (prod.get("title") or "").strip()
        handle = prod.get("handle")
        if not title or not handle:
            return None

        variants = prod.get("variants") or []
        price = None
        for v in variants:
            if v.get("available") and v.get("price"):
                try:
                    price = float(v["price"])
                    break
                except (TypeError, ValueError):
                    continue
        if price is None and variants:
            try:
                price = float(variants[0].get("price") or 0)
            except (TypeError, ValueError):
                price = None
        if price is None or price <= 0:
            return None

        product_url = urljoin(
            self.site.base_url.rstrip("/") + "/",
            f"products/{handle}",
        )
        return ScrapedItem(
            title=title,
            url=product_url,
            price=price,
            currency="INR",
            condition="new",
            category=category,
            seller=prod.get("vendor"),
        )
