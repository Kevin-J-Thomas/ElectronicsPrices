"""Scraper for Computech (computechstore.in).

Computech runs a Next.js SPA backed by a custom internal API
(``/api/products/public``). The API itself is firewalled (403 to plain
``requests``) and the listing pages (``/shop``, ``/product-category/<slug>``)
do **not** server-side render the product grid — they ship a skeleton plus
filter chrome and let the client hydrate the products.

What the public site DOES expose:

* The **homepage** is server-side-rendered with ~120 product-item cards
  (title, sale price, MRP, slug) inline in the HTML.
* The site publishes a real **product sitemap** at
  ``/product-sitemap.xml`` (index pointing at ``?page=1`` and ``?page=2``)
  that lists every product URL — ~20k entries.
* Each individual **product detail page** (``/product/<slug>``) is fully
  SSR'd with title in ``<h1>`` and price (``₹...``) in plain HTML.

Strategy: parse homepage cards, then crawl the product sitemap and fetch
each product detail page concurrently to extract title + price. We cap
the crawl at ``max_products`` per run so nightly jobs stay well-behaved.

Site.config schema (all optional):
    {
        "request_timeout": 25,           # per-request timeout (seconds)
        "extra_pages": [...],            # legacy: extra listing pages parsed
                                          # the same way as the homepage (cards)
        "use_sitemap": true,             # default true
        "sitemap_url": "/product-sitemap.xml",
        "max_products": 5000,            # cap on detail-page fetches per run
        "concurrency": 8,                # parallel detail-page fetches
        "detail_request_timeout": 20,    # per-detail timeout
    }
"""
from __future__ import annotations

import logging
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Iterable
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from app.scrapers.base import BaseScraper, ScrapedItem, ScrapeResult

log = logging.getLogger(__name__)

DEFAULT_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/121.0 Safari/537.36"
)
PRODUCT_HREF_RE = re.compile(r"^/product/[a-z0-9][a-z0-9-]+$", re.IGNORECASE)
PRODUCT_PATH_RE = re.compile(r"^/product/[a-z0-9][a-z0-9-]+$", re.IGNORECASE)
PRICE_RE = re.compile(r"₹\s*([\d,]+)")
SITEMAP_LOC_RE = re.compile(r"<loc>([^<]+)</loc>", re.IGNORECASE)


class ComputechScraper(BaseScraper):
    def scrape(self) -> ScrapeResult:
        result = ScrapeResult()
        config = self.site.config or {}
        timeout = int(config.get("request_timeout", 25))
        detail_timeout = int(config.get("detail_request_timeout", 20))
        extra_pages: list[str] = config.get("extra_pages") or []
        use_sitemap = bool(config.get("use_sitemap", True))
        sitemap_url_path = config.get("sitemap_url", "/product-sitemap.xml")
        max_products = int(config.get("max_products", 5000))
        concurrency = max(1, int(config.get("concurrency", 8)))

        headers = {"User-Agent": self.site.user_agent or DEFAULT_UA}
        session = requests.Session()
        session.headers.update(headers)
        # Size the connection pool to comfortably fit our concurrency.
        adapter = requests.adapters.HTTPAdapter(
            pool_connections=max(10, concurrency * 2),
            pool_maxsize=max(10, concurrency * 2),
            max_retries=0,
        )
        session.mount("https://", adapter)
        session.mount("http://", adapter)

        seen_urls: set[str] = set()

        # 1) Homepage + any legacy extra listing pages — parse like the
        #    homepage (product-item cards with title + price inline).
        listing_paths = ["/"] + list(extra_pages)
        for path in listing_paths:
            page_url = urljoin(self.site.base_url.rstrip("/") + "/", path.lstrip("/"))
            try:
                resp = session.get(page_url, timeout=timeout)
            except requests.RequestException as exc:
                result.errors.append(f"{page_url}: {exc}")
                continue
            if resp.status_code >= 400:
                result.errors.append(f"{page_url}: HTTP {resp.status_code}")
                continue
            page_added = self._parse_listing_html(resp.text, seen_urls, result)
            log.info(
                "Computech listing: %s — added %d (running=%d)",
                page_url, page_added, len(result.items),
            )

        # 2) Sitemap-driven product detail crawl. This is what gets us from
        #    ~120 listings to thousands.
        if use_sitemap and max_products > 0:
            sitemap_full = urljoin(
                self.site.base_url.rstrip("/") + "/", sitemap_url_path.lstrip("/"),
            )
            try:
                product_urls = self._collect_sitemap_product_urls(
                    session, sitemap_full, timeout=timeout,
                )
            except Exception as exc:  # pylint: disable=broad-except
                result.errors.append(f"sitemap {sitemap_full}: {exc}")
                product_urls = []

            # Drop any URLs we already grabbed from the listing pages.
            product_urls = [u for u in product_urls if u not in seen_urls]
            if max_products and len(product_urls) > max_products:
                log.info(
                    "Computech sitemap: %d products discovered, capping at %d",
                    len(product_urls), max_products,
                )
                product_urls = product_urls[:max_products]

            log.info(
                "Computech sitemap: fetching %d product pages (concurrency=%d)",
                len(product_urls), concurrency,
            )
            self._fetch_detail_pages(
                session,
                product_urls,
                seen_urls,
                result,
                concurrency=concurrency,
                timeout=detail_timeout,
            )

        log.info(
            "Computech scrape: %s — %d unique items, %d errors",
            self.site.name, len(result.items), len(result.errors),
        )
        return result

    # ------------------------------------------------------------------
    # Listing-page parsing (homepage / featured cards)
    # ------------------------------------------------------------------
    def _parse_listing_html(
        self,
        html: str,
        seen_urls: set[str],
        result: ScrapeResult,
    ) -> int:
        soup = BeautifulSoup(html, "lxml")
        anchors = soup.find_all("a", href=PRODUCT_HREF_RE)

        added = 0
        for a in anchors:
            href = a.get("href") or ""
            product_url = urljoin(self.site.base_url.rstrip("/") + "/", href.lstrip("/"))
            if product_url in seen_urls:
                continue

            # Scope to the tightest "product-item" card so we don't pick up
            # text from a sibling card or the page header.
            card = a.find_parent(class_=re.compile(r"\bproduct-item\b"))
            if card is None:
                # Banner/hero anchors live in a swiper-slide with no card —
                # skip them; they don't carry price metadata.
                continue
            container_text = card.get_text(" ", strip=True)
            price_match = PRICE_RE.search(container_text)
            if not price_match:
                continue
            try:
                price = float(price_match.group(1).replace(",", ""))
            except ValueError:
                continue
            if price <= 0:
                continue

            title = self._best_title(a, card, container_text)
            if not title or len(title) < 4:
                continue

            seen_urls.add(product_url)
            result.items.append(
                ScrapedItem(
                    title=title,
                    url=product_url,
                    price=price,
                    currency="INR",
                    condition="new",
                )
            )
            added += 1
        return added

    @staticmethod
    def _best_title(anchor, card, container_text: str) -> str:
        # 1. Image alt inside the card is usually the cleanest product name
        img = card.find("img", alt=True)
        if img:
            alt = (img.get("alt") or "").strip()
            if alt and alt.lower() not in {"banner", "image", "product"} and len(alt) >= 4:
                return alt
        # 2. anchor's aria-label / title
        for attr in ("aria-label", "title"):
            v = anchor.get(attr)
            if v and len(v.strip()) >= 4:
                return v.strip()
        # 3. Strip UI chrome from the card's flattened text
        text = container_text
        text = re.sub(r"^\s*(Add To Cart|Buy Now|Quick View)\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(
            r"₹\s*[\d,]+(\s*₹\s*[\d,]+)?\s*(-\s*\d+\s*%)?\s*$", "", text,
        )
        return text.strip()

    # ------------------------------------------------------------------
    # Sitemap walking
    # ------------------------------------------------------------------
    def _collect_sitemap_product_urls(
        self,
        session: requests.Session,
        sitemap_url: str,
        timeout: int,
    ) -> list[str]:
        """Return absolute /product/<slug> URLs from a sitemap (index or leaf).

        Handles a sitemap index pointing at one or more sub-sitemaps, and a
        plain leaf sitemap with <url><loc>...</loc></url> entries.
        """
        seen: set[str] = set()
        out: list[str] = []
        to_visit: list[str] = [sitemap_url]
        visited: set[str] = set()

        while to_visit:
            url = to_visit.pop(0)
            if url in visited:
                continue
            visited.add(url)
            try:
                resp = session.get(url, timeout=timeout)
            except requests.RequestException as exc:
                log.warning("Computech sitemap: %s — %s", url, exc)
                continue
            if resp.status_code >= 400:
                log.warning("Computech sitemap: %s — HTTP %s", url, resp.status_code)
                continue

            body = resp.text
            locs = SITEMAP_LOC_RE.findall(body)
            is_index = "<sitemapindex" in body[:2000].lower()
            for loc in locs:
                loc = loc.strip()
                if not loc:
                    continue
                if is_index:
                    to_visit.append(loc)
                    continue
                # Filter to product detail URLs only.
                # Tolerate trailing slashes / query strings.
                path = loc.split("://", 1)[-1].split("/", 1)
                if len(path) != 2:
                    continue
                clean_path = "/" + path[1].split("?", 1)[0].rstrip("/")
                if not PRODUCT_PATH_RE.match(clean_path):
                    continue
                if loc in seen:
                    continue
                seen.add(loc)
                out.append(loc)

            log.info(
                "Computech sitemap: %s — %d <loc> entries (%s) (running products=%d)",
                url, len(locs), "index" if is_index else "leaf", len(out),
            )

        return out

    # ------------------------------------------------------------------
    # Product detail-page fetch (parallel)
    # ------------------------------------------------------------------
    def _fetch_detail_pages(
        self,
        session: requests.Session,
        urls: Iterable[str],
        seen_urls: set[str],
        result: ScrapeResult,
        concurrency: int,
        timeout: int,
    ) -> None:
        url_list = list(urls)
        if not url_list:
            return

        # ThreadPoolExecutor + Session is fine: requests.Session is thread-safe
        # for read-only header reuse + concurrent .get().
        added = 0
        errors_this_phase = 0
        with ThreadPoolExecutor(max_workers=concurrency) as pool:
            futures = {
                pool.submit(self._fetch_one_detail, session, url, timeout): url
                for url in url_list
            }
            for i, fut in enumerate(as_completed(futures), 1):
                url = futures[fut]
                try:
                    item = fut.result()
                except Exception as exc:  # pylint: disable=broad-except
                    errors_this_phase += 1
                    if errors_this_phase <= 25:
                        result.errors.append(f"{url}: {exc}")
                    continue
                if item is None:
                    continue
                if item.url in seen_urls:
                    continue
                seen_urls.add(item.url)
                result.items.append(item)
                added += 1
                if i % 250 == 0:
                    log.info(
                        "Computech detail crawl: %d/%d processed — added %d so far",
                        i, len(url_list), added,
                    )
        log.info(
            "Computech detail crawl complete: added %d items from %d URLs (%d errors)",
            added, len(url_list), errors_this_phase,
        )

    def _fetch_one_detail(
        self,
        session: requests.Session,
        url: str,
        timeout: int,
    ) -> ScrapedItem | None:
        try:
            resp = session.get(url, timeout=timeout)
        except requests.RequestException as exc:
            raise exc
        if resp.status_code >= 400:
            return None
        return self._parse_detail_html(resp.text, url)

    @staticmethod
    def _parse_detail_html(html: str, url: str) -> ScrapedItem | None:
        soup = BeautifulSoup(html, "lxml")

        # Title from <h1>; the homepage card alt text is also usually present
        # but the h1 is the most reliable on detail pages.
        h1 = soup.find("h1")
        title = (h1.get_text(strip=True) if h1 else "").strip()
        if not title or len(title) < 4:
            # Fallback: og:title meta
            og = soup.find("meta", attrs={"property": "og:title"})
            if og and og.get("content"):
                title = og["content"].strip()
        if not title or len(title) < 4:
            return None

        # Price — first ₹ amount is the sale price; second (if any) is MRP.
        price_match = PRICE_RE.search(soup.get_text(" ", strip=True))
        if not price_match:
            return None
        try:
            price = float(price_match.group(1).replace(",", ""))
        except ValueError:
            return None
        if price <= 0:
            return None

        return ScrapedItem(
            title=title,
            url=url,
            price=price,
            currency="INR",
            condition="new",
        )
