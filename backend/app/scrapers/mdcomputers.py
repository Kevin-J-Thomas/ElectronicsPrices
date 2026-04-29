"""MDComputers scraper — direct from www.mdcomputers.in (OpenCart + Cloudflare).

The MDComputers storefront is an OpenCart 3.x site fronted by Cloudflare's
JS-challenge bot manager. Plain HTTP clients are blocked outright; vanilla
Playwright passes the first navigation but gets re-flagged on subsequent
`/catalog/<slug>` page loads in the same browser session — Cloudflare
fingerprints the headless context and starts serving an interstitial.

The Acer scraper hit the same shape of problem (Akamai bot manager) and
the working recipe was ``playwright-stealth`` + a fresh browser process per
page. We re-use that exact pattern here: every category page (and every
``?page=N`` paginated page within it) is fetched in its own Chromium process,
which prevents Cloudflare from correlating the navigations and re-issuing
the JS challenge.

Product cards on MDComputers follow a stable OpenCart layout:
    .product-grid-item
        .product-entities-title a   (title + product URL)
        .price-new                  (current selling price)
        .price                      (fallback — list price as plain text)

Pagination is the standard OpenCart ``?page=N`` query string.

Site.config schema (all optional)::

    {
        "category_urls": {                # category -> /catalog/<slug>
            "processor":     "/catalog/processor",
            "graphics-card": "/catalog/graphics-card",
            ...
        },
        "max_pages":     6,               # ?page=N pages per category
        "settle_ms":     5000,            # post-load DOM settle
        "min_delay_s":   18,              # min sec between page loads
        "max_delay_s":   28,              # max sec between page loads
        "viewport":      {"width": 1440, "height": 900}
    }
"""
from __future__ import annotations

import logging
import random
import re
import time
from urllib.parse import urljoin

from app.scrapers.base import BaseScraper, ScrapedItem, ScrapeResult

log = logging.getLogger(__name__)


DEFAULT_UAS: list[str] = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
]

DEFAULT_CATEGORY_URLS: dict[str, str] = {
    "processor":     "/catalog/processor",
    "graphics-card": "/catalog/graphics-card",
    "motherboard":   "/catalog/motherboard",
    "ram":           "/catalog/ram",
    "ssd":           "/catalog/ssd-drive",
    "hdd":           "/catalog/hard-drive",
    "smps":          "/catalog/smps",
    "cpu-cooler":    "/catalog/cpu-cooler",
    "cabinet-fan":   "/catalog/cabinet-fan",
}


class MDComputersScraper(BaseScraper):
    """Stealth-Playwright scraper for mdcomputers.in (OpenCart 3.x)."""

    BASE_URL = "https://www.mdcomputers.in"

    def scrape(self) -> ScrapeResult:
        result = ScrapeResult()
        config = self.site.config or {}

        category_urls: dict[str, str] = (
            config.get("category_urls") or DEFAULT_CATEGORY_URLS
        )
        max_pages = int(config.get("max_pages", 6))
        settle_ms = int(config.get("settle_ms", 5000))
        min_delay_s = float(config.get("min_delay_s", 18))
        max_delay_s = float(config.get("max_delay_s", 28))
        viewport = config.get("viewport") or {"width": 1440, "height": 900}

        seen_urls: set[str] = set()

        # Lazy imports — only worker needs Playwright + stealth
        from playwright.sync_api import sync_playwright
        from playwright_stealth import Stealth

        for category, path in category_urls.items():
            consecutive_no_new = 0
            for page_num in range(1, max_pages + 1):
                url = urljoin(self.BASE_URL + "/", path.lstrip("/"))
                if page_num > 1:
                    url = f"{url}?page={page_num}"

                # Fresh browser per page — Cloudflare flags reused contexts fast
                ua = random.choice(DEFAULT_UAS)
                try:
                    page_html = self._fetch_html(
                        url=url, ua=ua, viewport=viewport, settle_ms=settle_ms,
                        sync_playwright=sync_playwright, Stealth=Stealth,
                    )
                except Exception as exc:
                    msg = (
                        f"MDComputers {category} p={page_num}: "
                        f"{type(exc).__name__}: {exc}"
                    )
                    log.warning(msg)
                    result.errors.append(msg)
                    # Stop paginating this category — CF likely flagged us
                    break

                items = self._parse_products(page_html, category)
                added = 0
                for it in items:
                    if it.url in seen_urls:
                        continue
                    seen_urls.add(it.url)
                    result.items.append(it)
                    added += 1
                log.info(
                    "MDComputers: %s p=%d → %d cards, %d new (running total %d)",
                    category, page_num, len(items), added, len(result.items),
                )

                # Empty page — past the last paginated page
                if not items:
                    break

                # Two consecutive pages with no new items = MDComputers'
                # ``?page=N`` parameter has stopped paginating (it appears to
                # cap at 2 distinct pages in practice; later pages just return
                # the same product subset). Break to spend the time budget on
                # the next category.
                if added == 0:
                    consecutive_no_new += 1
                    if consecutive_no_new >= 1:
                        break
                else:
                    consecutive_no_new = 0

                # Pacing between page loads — Cloudflare gets twitchy if pages
                # stream in too fast.
                delay = random.uniform(min_delay_s, max_delay_s)
                time.sleep(delay)

            # Inter-category gap as well — fresh browser per page already helps
            # but a small extra cooldown keeps Cloudflare's heuristics quiet.
            time.sleep(random.uniform(min_delay_s, max_delay_s))

        log.info(
            "MDComputers: %d unique items, %d errors",
            len(result.items), len(result.errors),
        )
        return result

    # ------------------------------------------------------------------

    def _fetch_html(
        self,
        url: str,
        ua: str,
        viewport: dict,
        settle_ms: int,
        sync_playwright,
        Stealth,
    ) -> str:
        """Launch a fresh stealth browser, navigate, return rendered HTML."""
        with Stealth().use_sync(sync_playwright()) as p:
            browser = p.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-blink-features=AutomationControlled",
                ],
            )
            try:
                ctx = browser.new_context(
                    user_agent=ua,
                    locale="en-IN",
                    timezone_id="Asia/Kolkata",
                    viewport=viewport,
                    extra_http_headers={
                        "Accept-Language": "en-IN,en;q=0.9",
                        "Accept": (
                            "text/html,application/xhtml+xml,application/xml;q=0.9,"
                            "image/avif,image/webp,*/*;q=0.8"
                        ),
                    },
                )
                page = ctx.new_page()
                page.goto(url, wait_until="domcontentloaded", timeout=45000)
                # Wait for OpenCart product grid to render
                try:
                    page.wait_for_selector(
                        ".product-grid-item", timeout=15000,
                    )
                except Exception:
                    # Cloudflare interstitial or empty page — still grab HTML
                    # so we can detect the challenge in the parser.
                    pass
                page.wait_for_timeout(settle_ms)
                return page.content()
            finally:
                browser.close()

    @staticmethod
    def _parse_products(html: str, category: str) -> list[ScrapedItem]:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")
        out: list[ScrapedItem] = []
        cards = soup.select(".product-grid-item")
        for card in cards:
            # Title + URL: the product title anchor is the canonical source.
            title_a = card.select_one(".product-entities-title a")
            title = ""
            href = ""
            if title_a:
                title = (title_a.get_text() or "").strip()
                href = (title_a.get("href") or "").strip()

            # Fallback: image-link or alt text
            if not href:
                a = card.select_one("a.product-image-link, a[href*='/']")
                if a:
                    href = (a.get("href") or "").strip()
            if not title:
                img = card.select_one("img[alt]")
                if img:
                    title = (img.get("alt") or "").strip()

            if not title or not href:
                continue

            # Price extraction. OpenCart on MDComputers uses:
            #   .price .price-new        — sale price (preferred when present)
            #   .price                   — falls back to list price text
            price_amt: float | None = None
            price_new = card.select_one(".price .price-new, .price-new")
            if price_new:
                price_amt = _extract_inr(price_new.get_text(" ", strip=True))
            if price_amt is None:
                price_el = card.select_one(".price")
                if price_el:
                    price_amt = _extract_inr(price_el.get_text(" ", strip=True))
            if price_amt is None:
                # Last-ditch: scan whole card text for a ₹ amount
                price_amt = _extract_inr(card.get_text(" ", strip=True))

            if price_amt is None or price_amt <= 0:
                continue

            out.append(
                ScrapedItem(
                    title=title[:300],
                    url=href,
                    price=price_amt,
                    currency="INR",
                    condition="new",
                    category=category,
                )
            )
        return out


_PRICE_RE = re.compile(r"₹\s*([\d,]+(?:\.\d+)?)")


def _extract_inr(text: str) -> float | None:
    """Parse the first ``₹X,XXX[.YY]`` amount out of a string."""
    if not text:
        return None
    m = _PRICE_RE.search(text)
    if not m:
        return None
    try:
        return float(m.group(1).replace(",", ""))
    except ValueError:
        return None
