"""Scraper for WooCommerce stores using the public Store API.

WooCommerce ships a Store API (since v8.x) at:
    /wp-json/wc/store/v1/products?per_page=N&page=P

It returns clean JSON (name, permalink, prices.price as integer minor units,
sku, images, attributes). No selectors needed, works on any modern WordPress
+ WooCommerce site that hasn't actively disabled the API.

Optional config (all optional):
    {
        "category_slugs": ["processor", "ram", "graphics-card"],  # filter by category
        "per_page": 50,        # max 100 (Store API limit)
        "max_pages": 10,
        "request_timeout": 25
    }

If no category_slugs given, scrapes ALL products (Store API supports paging
through the entire catalog).
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
PER_PAGE_MAX = 100


class WooCommerceScraper(BaseScraper):
    def scrape(self) -> ScrapeResult:
        result = ScrapeResult()
        config = self.site.config or {}
        category_slugs: list[str] = config.get("category_slugs") or []
        per_page = min(int(config.get("per_page", 50)), PER_PAGE_MAX)
        max_pages = int(config.get("max_pages", 10))
        timeout = int(config.get("request_timeout", 25))

        headers = {"User-Agent": self.site.user_agent or DEFAULT_UA, "Accept": "application/json"}
        seen_urls: set[str] = set()

        # If no category slugs configured, paginate the whole catalog.
        targets = category_slugs or [None]

        for slug in targets:
            label = slug or "all"
            log.info("WooCommerce scrape: %s / %s", self.site.name, label)
            page_count = 0
            for page in range(1, max_pages + 1):
                qs = f"per_page={per_page}&page={page}&orderby=date&order=desc"
                if slug:
                    qs += f"&category={slug}"
                url = urljoin(
                    self.site.base_url.rstrip("/") + "/",
                    f"wp-json/wc/store/v1/products?{qs}",
                )
                try:
                    resp = requests.get(url, headers=headers, timeout=timeout)
                except requests.RequestException as exc:
                    result.errors.append(f"{url}: {exc}")
                    break

                if resp.status_code == 404:
                    result.errors.append(f"{url}: 404 — Store API not available")
                    break
                if resp.status_code >= 400:
                    result.errors.append(f"{url}: HTTP {resp.status_code}")
                    break

                try:
                    payload = resp.json()
                except ValueError:
                    result.errors.append(f"{url}: invalid JSON response")
                    break

                if not isinstance(payload, list) or not payload:
                    break  # no more pages
                page_count += 1

                for prod in payload:
                    item = self._parse_product(prod, label)
                    if item and item.url not in seen_urls:
                        seen_urls.add(item.url)
                        result.items.append(item)

                if len(payload) < per_page:
                    break  # last page

            log.info(
                "WooCommerce scrape: %s / %s — %d page(s) processed",
                self.site.name, label, page_count,
            )

        log.info(
            "WooCommerce scrape: %s — %d unique items, %d errors",
            self.site.name, len(result.items), len(result.errors),
        )
        return result

    def _parse_product(self, prod: dict, category_label: str) -> ScrapedItem | None:
        name = (prod.get("name") or "").strip()
        permalink = prod.get("permalink")
        if not name or not permalink:
            return None

        prices = prod.get("prices") or {}
        raw_price = prices.get("price")
        minor = int(prices.get("currency_minor_unit", 2))
        currency = prices.get("currency_code") or "INR"
        if raw_price is None:
            return None
        try:
            price = float(raw_price) / (10 ** minor)
        except (TypeError, ValueError):
            return None
        if price <= 0:
            return None

        # Some sites return the permalink as full URL; others as path.
        item_url = (
            permalink if permalink.startswith("http")
            else urljoin(self.site.base_url.rstrip("/") + "/", permalink.lstrip("/"))
        )

        # Try to surface a vendor/brand from product attributes
        vendor = None
        for attr in (prod.get("attributes") or []):
            label = (attr.get("name") or "").lower()
            if label in ("brand", "manufacturer"):
                terms = attr.get("terms") or []
                if terms:
                    vendor = terms[0].get("name") or terms[0].get("slug")
                    break

        return ScrapedItem(
            title=name,
            url=item_url,
            price=price,
            currency=currency,
            condition="new",
            category=category_label,
            seller=vendor,
        )
