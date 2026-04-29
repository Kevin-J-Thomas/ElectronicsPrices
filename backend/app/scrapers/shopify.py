"""Scraper for Shopify-based stores using the public products.json endpoint.

Two operating modes:

1. **Per-collection** (default): walks
       /collections/<handle>/products.json?limit=N&page=P
   for every handle declared in ``category_handles``. Use this when the
   storefront has a curated set of relevant collections you want to track.

2. **Full-catalog**: walks the **store-wide**
       /products.json?limit=250&page=P
   endpoint, which Shopify exposes by default and which returns every
   published product in the store (paginated). This is the right mode
   when you want the entire catalog and don't want to maintain a list
   of collection handles.

   Triggered when EITHER:
     * ``use_full_catalog: true`` is set in ``Site.config``, OR
     * ``category_handles`` is empty / missing.

   Walks pages until an empty response, capped at ``max_products`` /
   ``max_pages`` whichever hits first. Items are fetched concurrently
   when ``concurrency > 1``.

Site.config schema:
    {
        # --- Per-collection mode ---
        "category_handles": {
            "processor": "processor",
            "ram": "ram",
            ...
        },

        # --- Full-catalog mode ---
        "use_full_catalog": false,         # default false
        "max_products": 12000,             # cap on items collected
                                            # (default: unlimited in per-collection,
                                            #  12000 in full-catalog)
        "concurrency": 1,                  # parallel page fetches
                                            # (full-catalog only; default 1)
        "inter_wave_delay": 0.0,           # seconds to sleep between
                                            # parallel waves (avoids 429s)

        # --- Shared ---
        "per_page": 250,                   # max 250 (Shopify limit)
        "max_pages": 5,                    # safety cap, applies to each
                                            # collection in per-collection mode
                                            # and to the global walk in
                                            # full-catalog mode
        "request_timeout": 25              # seconds
    }
"""
from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin

import httpx

from app.scrapers.base import BaseScraper, ScrapedItem, ScrapeResult

log = logging.getLogger(__name__)

DEFAULT_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/121.0 Safari/537.36"
)

# Hard upper bound on full-catalog pagination — Shopify returns empty
# pages past the end, but we want a guaranteed stopping condition even
# if a misconfigured store endlessly returns the same page.
FULL_CATALOG_PAGE_LIMIT = 200


class ShopifyScraper(BaseScraper):
    def scrape(self) -> ScrapeResult:
        result = ScrapeResult()
        config = self.site.config or {}
        handles: dict[str, str] = config.get("category_handles") or {}
        use_full_catalog = bool(config.get("use_full_catalog", False))

        # Auto-enable full-catalog mode when no handles are configured.
        if not handles and not use_full_catalog:
            use_full_catalog = True
            log.info(
                "Shopify scrape: %s — no category_handles set, "
                "auto-enabling full-catalog mode",
                self.site.name,
            )

        if use_full_catalog:
            return self._scrape_full_catalog(result, config)
        return self._scrape_by_collection(result, config, handles)

    # ------------------------------------------------------------------
    # Per-collection mode (existing behaviour — unchanged)
    # ------------------------------------------------------------------
    def _scrape_by_collection(
        self,
        result: ScrapeResult,
        config: dict,
        handles: dict[str, str],
    ) -> ScrapeResult:
        per_page = min(int(config.get("per_page", 50)), 250)
        max_pages = int(config.get("max_pages", 5))
        timeout = int(config.get("request_timeout", 20))

        target_categories = self.categories or list(handles.keys())
        headers = {
            "User-Agent": self.site.user_agent or DEFAULT_UA,
            "Accept": "application/json",
        }
        seen_urls: set[str] = set()

        # httpx (rather than `requests`) avoids Cloudflare TLS-fingerprint
        # blocks on stores like microcenterindia.com that 429 stock urllib3.
        with httpx.Client(headers=headers, timeout=timeout, follow_redirects=True) as client:
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
                        resp = client.get(url)
                    except httpx.HTTPError as exc:
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

    # ------------------------------------------------------------------
    # Full-catalog mode (store-wide /products.json)
    # ------------------------------------------------------------------
    def _scrape_full_catalog(
        self,
        result: ScrapeResult,
        config: dict,
    ) -> ScrapeResult:
        per_page = min(int(config.get("per_page", 250)), 250)
        # In full-catalog mode the page count can be large — default to
        # the hard ceiling so we don't accidentally truncate big stores.
        max_pages = min(
            int(config.get("max_pages", FULL_CATALOG_PAGE_LIMIT)),
            FULL_CATALOG_PAGE_LIMIT,
        )
        timeout = int(config.get("request_timeout", 25))
        max_products = int(config.get("max_products", 12000))
        concurrency = max(1, int(config.get("concurrency", 1)))
        inter_wave_delay = max(0.0, float(config.get("inter_wave_delay", 0.0)))

        headers = {
            "User-Agent": self.site.user_agent or DEFAULT_UA,
            "Accept": "application/json",
        }
        # httpx Client (rather than `requests.Session`) so Cloudflare's
        # TLS fingerprint check on hosts like microcenterindia.com lets
        # us through. The pool size scales with concurrency for the
        # threaded path.
        limits = httpx.Limits(
            max_connections=max(10, concurrency * 2),
            max_keepalive_connections=max(10, concurrency * 2),
        )
        client = httpx.Client(
            headers=headers,
            timeout=timeout,
            limits=limits,
            follow_redirects=True,
        )

        seen_urls: set[str] = set()
        base = self.site.base_url.rstrip("/") + "/"
        log.info(
            "Shopify scrape: %s — full-catalog mode "
            "(per_page=%d, max_pages=%d, max_products=%d, concurrency=%d)",
            self.site.name, per_page, max_pages, max_products, concurrency,
        )

        try:
            if concurrency == 1:
                self._walk_pages_sequential(
                    client, base, per_page, max_pages, timeout,
                    max_products, seen_urls, result,
                )
            else:
                self._walk_pages_concurrent(
                    client, base, per_page, max_pages, timeout,
                    max_products, concurrency, inter_wave_delay,
                    seen_urls, result,
                )
        finally:
            client.close()

        log.info(
            "Shopify scrape: %s — %d unique items, %d errors (full-catalog)",
            self.site.name, len(result.items), len(result.errors),
        )
        return result

    def _walk_pages_sequential(
        self,
        client: httpx.Client,
        base: str,
        per_page: int,
        max_pages: int,
        timeout: int,
        max_products: int,
        seen_urls: set[str],
        result: ScrapeResult,
    ) -> None:
        for page in range(1, max_pages + 1):
            if max_products and len(result.items) >= max_products:
                log.info(
                    "Shopify full-catalog: %s — reached max_products=%d, stopping",
                    self.site.name, max_products,
                )
                break
            url = urljoin(base, f"products.json?limit={per_page}&page={page}")
            products = self._fetch_page(client, url, timeout, result)
            if products is None:
                # Hard error already recorded — stop walking.
                break
            if not products:
                log.info(
                    "Shopify full-catalog: %s — page %d empty, end of catalog "
                    "(%d items collected)",
                    self.site.name, page, len(result.items),
                )
                break
            self._absorb_products(products, seen_urls, result, max_products)
            if page % 10 == 0:
                log.info(
                    "Shopify full-catalog: %s — page %d processed "
                    "(running=%d)",
                    self.site.name, page, len(result.items),
                )
            if len(products) < per_page:
                break  # last page

    def _walk_pages_concurrent(
        self,
        client: httpx.Client,
        base: str,
        per_page: int,
        max_pages: int,
        timeout: int,
        max_products: int,
        concurrency: int,
        inter_wave_delay: float,
        seen_urls: set[str],
        result: ScrapeResult,
    ) -> None:
        # Concurrent walk in waves of `concurrency` pages. After each wave
        # we check the cap and whether any page came back empty (which
        # signals end-of-catalog).
        page = 1
        end_reached = False
        while page <= max_pages and not end_reached:
            if max_products and len(result.items) >= max_products:
                log.info(
                    "Shopify full-catalog: %s — reached max_products=%d, stopping",
                    self.site.name, max_products,
                )
                break

            wave_start = page
            wave_end = min(page + concurrency - 1, max_pages)
            urls = [
                (
                    p,
                    urljoin(base, f"products.json?limit={per_page}&page={p}"),
                )
                for p in range(wave_start, wave_end + 1)
            ]
            page = wave_end + 1

            with ThreadPoolExecutor(max_workers=concurrency) as pool:
                futures = {
                    pool.submit(self._fetch_page, client, url, timeout, result): pnum
                    for pnum, url in urls
                }
                # Preserve page order in results so dedup is deterministic.
                wave_results: dict[int, list | None] = {}
                for fut in as_completed(futures):
                    pnum = futures[fut]
                    try:
                        wave_results[pnum] = fut.result()
                    except Exception as exc:  # pylint: disable=broad-except
                        result.errors.append(f"page {pnum}: {exc}")
                        wave_results[pnum] = None

            for pnum in sorted(wave_results.keys()):
                products = wave_results[pnum]
                if products is None:
                    # Hard fetch error — keep going across other pages, but
                    # don't treat this as end-of-catalog.
                    continue
                if not products:
                    log.info(
                        "Shopify full-catalog: %s — page %d empty, end of catalog",
                        self.site.name, pnum,
                    )
                    end_reached = True
                    break
                self._absorb_products(products, seen_urls, result, max_products)
                if len(products) < per_page:
                    end_reached = True
                    break
            log.info(
                "Shopify full-catalog: %s — pages %d-%d processed "
                "(running=%d)",
                self.site.name, wave_start, wave_end, len(result.items),
            )
            if inter_wave_delay and not end_reached:
                time.sleep(inter_wave_delay)

    def _fetch_page(
        self,
        client: httpx.Client,
        url: str,
        timeout: int,
        result: ScrapeResult,
        max_retries: int = 4,
    ) -> list | None:
        """Fetch one /products.json page with backoff on 429/5xx. Returns:
            list[product]   — products array (possibly empty)
            None            — hard error; caller should stop or skip
        """
        # Shopify rate-limits the public products.json endpoint fairly
        # aggressively when many parallel pages are requested. Honour
        # Retry-After when present, otherwise fall back to exponential
        # backoff. We retry a small number of times to ride through a
        # transient throttle without giving up the whole walk.
        backoff_base = 1.5
        for attempt in range(max_retries + 1):
            try:
                resp = client.get(url)
            except httpx.HTTPError as exc:
                if attempt == max_retries:
                    result.errors.append(f"{url}: {exc}")
                    return None
                time.sleep(backoff_base * (2 ** attempt))
                continue

            if resp.status_code == 404:
                result.errors.append(f"{url}: 404")
                return None
            if resp.status_code in (429, 500, 502, 503, 504):
                if attempt == max_retries:
                    result.errors.append(
                        f"{url}: HTTP {resp.status_code} after {attempt} retries"
                    )
                    return None
                retry_after = resp.headers.get("Retry-After")
                if retry_after:
                    try:
                        wait = max(1.0, float(retry_after))
                    except (TypeError, ValueError):
                        wait = backoff_base * (2 ** attempt)
                else:
                    wait = backoff_base * (2 ** attempt)
                time.sleep(wait)
                continue
            if resp.status_code >= 400:
                result.errors.append(f"{url}: HTTP {resp.status_code}")
                return None
            try:
                payload = resp.json()
            except ValueError:
                result.errors.append(f"{url}: invalid JSON response")
                return None
            return payload.get("products") or []
        return None

    def _absorb_products(
        self,
        products: list,
        seen_urls: set[str],
        result: ScrapeResult,
        max_products: int,
    ) -> None:
        for prod in products:
            if max_products and len(result.items) >= max_products:
                return
            # In full-catalog mode there is no per-category context, so
            # we tag the item by its Shopify product_type when present.
            category = (prod.get("product_type") or "").strip().lower() or None
            item = self._parse_product(prod, category)
            if item and item.url not in seen_urls:
                seen_urls.add(item.url)
                result.items.append(item)

    # ------------------------------------------------------------------
    # Product parsing (shared)
    # ------------------------------------------------------------------
    def _parse_product(self, prod: dict, category: str | None) -> ScrapedItem | None:
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
