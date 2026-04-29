"""Acer India scraper — direct from store.acer.com (Magento 2 + Akamai).

The Acer India ecommerce site is a Magento 2 storefront fronted by Akamai
Bot Manager. Plain HTTP clients are blocked at the TLS/JA4 layer; vanilla
Playwright triggers Akamai's `_abck` challenge with `ERR_HTTP2_PROTOCOL_ERROR`.

Empirically, `playwright-stealth` (v2.0.3+) bypasses the challenge as long as:
- A fresh browser is launched per category (no context reuse across pages)
- A real desktop UA is sent (not the Playwright default Chromium UA)
- en-IN locale + Asia/Kolkata timezone are set
- 15-30 s of randomised pacing separates page navigations
- The crawl stays modest in volume (no aggressive parallelism)

Magento exposes products as `li.product.product-item` cards with
`a.product-item-link` (title + URL) and `[data-price-amount]` (numeric INR).
Pagination is `?p=N` query string.

Site.config schema:
    {
        "category_urls": {                 # category -> path on store.acer.com
            "laptops":   "/en-in/laptops",
            "desktops":  "/en-in/desktops",
            "monitors":  "/en-in/monitors",
            "accessories": "/en-in/accessories"
        },
        "max_pages": 4,                    # pages of `?p=N` to traverse per cat
        "settle_ms": 4000,                 # post-load DOM settle time
        "min_delay_s": 15,                 # min delay between page loads
        "max_delay_s": 30,                 # max delay between page loads
        "viewport": {"width": 1440, "height": 900}
    }

Defaults match the layout observed on 2026-04-29 (10 cards/page, 4 pages of laptops).
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
    "laptops":  "/en-in/laptops",
    "desktops": "/en-in/desktops",
    "monitors": "/en-in/monitors",
}


class AcerScraper(BaseScraper):
    """Stealth-Playwright scraper for store.acer.com (Magento 2)."""

    BASE_URL = "https://store.acer.com"

    def scrape(self) -> ScrapeResult:
        result = ScrapeResult()
        config = self.site.config or {}

        category_urls: dict[str, str] = (
            config.get("category_urls") or DEFAULT_CATEGORY_URLS
        )
        max_pages = int(config.get("max_pages", 4))
        settle_ms = int(config.get("settle_ms", 4000))
        min_delay_s = float(config.get("min_delay_s", 15))
        max_delay_s = float(config.get("max_delay_s", 30))
        viewport = config.get("viewport") or {"width": 1440, "height": 900}

        seen_urls: set[str] = set()

        # Lazy imports — only worker needs Playwright + stealth
        from playwright.sync_api import sync_playwright
        from playwright_stealth import Stealth

        for category, path in category_urls.items():
            for page_num in range(1, max_pages + 1):
                url = urljoin(self.BASE_URL + "/", path.lstrip("/"))
                if page_num > 1:
                    url = f"{url}?p={page_num}"

                # Fresh browser per page — Akamai flags reused contexts fast
                ua = random.choice(DEFAULT_UAS)
                try:
                    page_html = self._fetch_html(
                        url=url, ua=ua, viewport=viewport, settle_ms=settle_ms,
                        sync_playwright=sync_playwright, Stealth=Stealth,
                    )
                except Exception as exc:
                    msg = f"Acer {category} p={page_num}: {type(exc).__name__}: {exc}"
                    log.warning(msg)
                    result.errors.append(msg)
                    # Stop paginating this category — Akamai likely flagged us
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
                    "Acer: %s p=%d → %d cards, %d new (running total %d)",
                    category, page_num, len(items), added, len(result.items),
                )

                # No more pages? bail early
                if not items or len(items) < 10:
                    break

                # Pacing between page loads
                delay = random.uniform(min_delay_s, max_delay_s)
                time.sleep(delay)

        log.info(
            "Acer: %d unique items, %d errors",
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
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=45000)
                # Wait for Magento product cards to render
                try:
                    page.wait_for_selector(
                        "li.product.product-item", timeout=15000,
                    )
                except Exception:
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
        cards = soup.select("li.product.product-item, .item.product.product-item")
        for card in cards:
            a = card.select_one("a.product-item-link")
            if not a:
                continue
            title = (a.get_text() or "").strip()
            href = (a.get("href") or "").strip()
            if not title or not href:
                continue

            # Magento exposes the numeric price as data-price-amount
            price_amt = None
            for el in card.select("[data-price-amount]"):
                # Skip "old price" / "msrp" wrappers — final "special-price" or
                # "price-final_price" is what we want. Default to first match.
                amt = el.get("data-price-amount")
                if amt:
                    try:
                        price_amt = float(amt)
                    except ValueError:
                        continue
                    break

            if price_amt is None or price_amt <= 0:
                # Fallback: parse "₹X,XXX" text
                txt = card.get_text(" ", strip=True)
                m = re.search(r"₹\s*([\d,]+(?:\.\d+)?)", txt)
                if not m:
                    continue
                try:
                    price_amt = float(m.group(1).replace(",", ""))
                except ValueError:
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
