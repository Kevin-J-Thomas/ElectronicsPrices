"""Scraper for Clarion Computers (shop.clarioncomputers.in).

Clarion runs the FleetCart Laravel storefront. The category and product-list
pages are SSR'd with only the first 7-12 product cards baked into the HTML;
the rest are loaded by a small XHR to ``GET /products`` which returns clean
Laravel-paginated JSON:

    GET /products?page=N&perPage=200
    GET /products?category=<slug>&page=N&perPage=200

Response shape::

    {
      "products": {
        "current_page": 1,
        "last_page": 10,
        "per_page": 200,
        "total": 1833,
        "data": [
          {
            "id": 119474,
            "slug": "msi-geforce-rtx-5070-...-graphics-card",
            "name": "MSI GeForce RTX 5070 ...",
            "price": {"amount": "92500", ...},
            "special_price": {"amount": "71990", ...},
            "selling_price": {"amount": "71990", ...},
            "is_in_stock": true, "is_out_of_stock": false,
            ...
          },
          ...
        ]
      }
    }

Storefront product URL is ``/product/<slug>`` (confirmed via sitemap.xml).

We hit the all-products endpoint by default, which drains the entire catalog
in ~10 pages of 200 items each (~1800 products). Categories are optional and
mostly redundant; supply ``categories`` in Site.categories or
``config.category_slugs`` if you want to scope a run.

Site.config schema (all optional)::

    {
        "per_page": 200,           # API per-page (max ~200 in practice)
        "max_pages": 12,           # safety cap; stops earlier when total reached
        "request_timeout": 25,
        "category_slugs": {        # optional category-filtered runs
            "graphics-card": "graphics-card",
            ...
        }
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
    "(KHTML, like Gecko) Chrome/125.0 Safari/537.36"
)


class ClarionScraper(BaseScraper):
    def scrape(self) -> ScrapeResult:
        result = ScrapeResult()
        config = self.site.config or {}
        per_page = int(config.get("per_page", 200))
        max_pages = int(config.get("max_pages", 12))
        timeout = int(config.get("request_timeout", 25))
        category_slugs: dict[str, str] = config.get("category_slugs") or {}

        base = self.site.base_url.rstrip("/")
        headers = {
            "User-Agent": self.site.user_agent or DEFAULT_UA,
            "Accept": "application/json, text/plain, */*",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": base + "/",
            "Origin": base,
        }

        seen_urls: set[str] = set()

        # Build the list of category filters. If the user asked for specific
        # categories AND we have slugs for them, only fetch those. Otherwise
        # fetch the entire catalog in one shot (no category filter).
        targets: list[tuple[str, str | None]] = []  # (label, slug-or-None)
        if self.categories and category_slugs:
            for cat in self.categories:
                slug = category_slugs.get(cat)
                if slug:
                    targets.append((cat, slug))
                else:
                    result.errors.append(f"No slug mapping for category '{cat}'")
        if not targets:
            targets = [("all", None)]

        session = requests.Session()
        session.headers.update(headers)

        for label, slug in targets:
            self._drain_endpoint(
                session=session,
                base=base,
                label=label,
                slug=slug,
                per_page=per_page,
                max_pages=max_pages,
                timeout=timeout,
                seen_urls=seen_urls,
                result=result,
            )

        log.info(
            "Clarion scrape: %s — %d unique items, %d errors",
            self.site.name, len(result.items), len(result.errors),
        )
        return result

    def _drain_endpoint(
        self,
        *,
        session: requests.Session,
        base: str,
        label: str,
        slug: str | None,
        per_page: int,
        max_pages: int,
        timeout: int,
        seen_urls: set[str],
        result: ScrapeResult,
    ) -> None:
        total: int | None = None
        for page in range(1, max_pages + 1):
            params = {"perPage": per_page, "page": page}
            if slug:
                params["category"] = slug
            url = f"{base}/products"
            try:
                resp = session.get(url, params=params, timeout=timeout)
            except requests.RequestException as exc:
                result.errors.append(f"{url} ({label} p{page}): {exc}")
                break

            if resp.status_code >= 400:
                result.errors.append(
                    f"{url} ({label} p{page}): HTTP {resp.status_code}"
                )
                break

            try:
                payload = resp.json()
            except ValueError:
                result.errors.append(f"{url} ({label} p{page}): invalid JSON")
                break

            products = payload.get("products") or {}
            data = products.get("data") or []
            if total is None:
                total = int(products.get("total") or 0)
                log.info("Clarion scrape: category=%s total=%d", label, total)

            page_added = 0
            for prod in data:
                item = self._parse_product(prod, label)
                if item and item.url not in seen_urls:
                    seen_urls.add(item.url)
                    result.items.append(item)
                    page_added += 1

            log.info(
                "Clarion scrape: cat=%s page=%d got=%d added=%d running=%d",
                label, page, len(data), page_added, len(result.items),
            )

            if not data:
                break
            if total and len(seen_urls) >= total and slug is None:
                # Only break early on the unfiltered scan — for category runs
                # we'd over-break because seen_urls is shared.
                break
            last_page = int(products.get("last_page") or 0)
            if last_page and page >= last_page:
                break
            if len(data) < per_page:
                break

    def _parse_product(self, prod: dict, category: str) -> ScrapedItem | None:
        name = (prod.get("name") or "").strip()
        slug = prod.get("slug")
        if not name or not slug:
            return None

        price = self._extract_price(prod)
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
            category=None if category == "all" else category,
        )

    @staticmethod
    def _extract_price(prod: dict) -> float | None:
        """Pick the live selling price.

        FleetCart returns three nested objects: ``selling_price`` (what the
        user pays — falls back to regular when no special), ``special_price``
        (sale price, may be null), and ``price`` (MRP). Always prefer
        selling_price for accuracy.
        """
        for key in ("selling_price", "special_price", "price"):
            obj = prod.get(key)
            if not isinstance(obj, dict):
                continue
            amount = obj.get("amount")
            if amount in (None, "", 0, "0"):
                continue
            try:
                val = float(amount)
            except (TypeError, ValueError):
                continue
            if val > 0:
                return val
        return None
