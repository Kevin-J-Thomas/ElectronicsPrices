"""Amazon India scraper using server-rendered search HTML.

Discovery (2026-04-27): Amazon.in serves complete, parseable search HTML to
plain HTTP requests with a normal browser User-Agent — no JS, no CAPTCHA, no
rate-limit on a small sequential crawl. We do NOT need Playwright, residential
proxies, PA-API, or any paid scraping service for the scale this app targets
(low-thousands of products, weekly refresh).

If Amazon ever flips on bot protection on this path, signs are easy to detect:
HTTP 503, presence of 'captcha' / 'Sorry, we just need to make sure', a redirect
to /errors/validateCaptcha — the scraper detects these and aborts the run.

Site.config schema:
    {
        "search_queries": [
            "ssd 1tb", "graphics card", "ddr5 ram",
            "gaming laptop", "intel cpu", "ryzen cpu",
            "monitor", "motherboard", "psu"
        ],
        "department": "computers",   # Amazon search 'i' param (default: computers)
        "max_pages": 3,              # pages per query (Amazon caps relevance after ~7)
        "delay_seconds": 2.0,        # politeness delay between requests
        "request_timeout": 25
    }

If config is empty we fall back to DEFAULT_QUERIES — a sensible PC-parts crawl.
"""
from __future__ import annotations

import logging
import re
import time
from typing import Any
from urllib.parse import urlencode

import httpx
from bs4 import BeautifulSoup

from app.scrapers.base import BaseScraper, ScrapedItem, ScrapeResult

log = logging.getLogger(__name__)

DEFAULT_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/125.0.0.0 Safari/537.36"
)

DEFAULT_QUERIES: list[str] = [
    "ssd 1tb", "ssd 2tb", "nvme",
    "graphics card", "rtx", "gpu",
    "ddr4 ram", "ddr5 ram",
    "intel cpu", "ryzen cpu",
    "motherboard", "psu", "cabinet",
    "monitor", "gaming laptop", "ultrabook",
]

PRICE_RE = re.compile(r"[\d,]+\.?\d*")

# Anti-bot signals — if any appear in the response we abort.
BOT_WALL_SIGNALS = (
    "validateCaptcha",
    "Sorry, we just need to make sure",
    "automated access",
    "Enter the characters you see below",
)


class AmazonScraper(BaseScraper):
    """Amazon India search-page scraper.

    Strategy: iterate over (search_query × page) and parse the standard
    search results layout. Each result card carries its ASIN as
    `data-asin`, which we use to canonicalise the product URL to
    `https://www.amazon.in/dp/<ASIN>` — that's stable across crawls
    even when the in-page link is a sponsored '#' placeholder.
    """

    SEARCH_URL = "https://www.amazon.in/s"
    PRODUCT_URL = "https://www.amazon.in/dp/{asin}"

    def scrape(self) -> ScrapeResult:
        result = ScrapeResult()
        config = self.site.config or {}

        queries: list[str] = config.get("search_queries") or DEFAULT_QUERIES
        department: str = config.get("department") or "computers"
        max_pages = int(config.get("max_pages", 3))
        delay = float(config.get("delay_seconds", 2.0))
        timeout = float(config.get("request_timeout", 25))

        ua = self.site.user_agent or DEFAULT_UA
        headers = {
            "User-Agent": ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-IN,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
        }

        seen_asins: set[str] = set()
        client = httpx.Client(
            headers=headers,
            timeout=httpx.Timeout(timeout, connect=10.0),
            follow_redirects=True,
        )

        try:
            for query in queries:
                for page in range(1, max_pages + 1):
                    params: dict[str, Any] = {
                        "k": query,
                        "i": department,
                        "page": page,
                    }
                    url = f"{self.SEARCH_URL}?{urlencode(params)}"
                    try:
                        resp = client.get(url)
                    except httpx.HTTPError as exc:
                        result.errors.append(f"Amazon q={query!r} p={page}: {exc}")
                        break

                    if resp.status_code != 200:
                        result.errors.append(
                            f"Amazon q={query!r} p={page}: HTTP {resp.status_code}"
                        )
                        # 503 / 429 means rate-limit or bot wall — stop the whole run
                        if resp.status_code in (429, 503):
                            result.errors.append(
                                "Amazon throttled or blocked — aborting remaining queries"
                            )
                            return result
                        break

                    body = resp.text
                    if any(sig in body for sig in BOT_WALL_SIGNALS):
                        result.errors.append(
                            "Amazon presented a CAPTCHA/bot wall — aborting run"
                        )
                        return result

                    page_items = self._parse_search_html(body, query, seen_asins)
                    if not page_items:
                        # No new items on this page → next page won't help
                        break
                    result.items.extend(page_items)

                    if delay > 0:
                        time.sleep(delay)
        finally:
            client.close()

        log.info(
            "Amazon: %d items across %d queries (errors=%d)",
            len(result.items), len(queries), len(result.errors),
        )
        return result

    # ------------------------------------------------------------------

    def _parse_search_html(
        self,
        html: str,
        category: str,
        seen_asins: set[str],
    ) -> list[ScrapedItem]:
        soup = BeautifulSoup(html, "lxml")
        cards = soup.select(
            'div.s-result-item[data-asin][data-component-type="s-search-result"]'
        )

        items: list[ScrapedItem] = []
        for card in cards:
            asin = (card.get("data-asin") or "").strip()
            if not asin or asin in seen_asins:
                continue

            title_el = card.select_one("h2 span") or card.select_one("h2")
            if not title_el:
                continue
            title = title_el.get_text(strip=True)
            if not title:
                continue

            price = self._extract_price(card)
            if price is None or price <= 0:
                continue

            seen_asins.add(asin)
            items.append(
                ScrapedItem(
                    title=title,
                    url=self.PRODUCT_URL.format(asin=asin),
                    price=price,
                    currency="INR",
                    condition="new",
                    category=category,
                    seller="Amazon.in",
                )
            )
        return items

    @staticmethod
    def _extract_price(card) -> float | None:
        # Preferred: hidden offscreen text like "₹14,990"
        el = card.select_one(".a-price .a-offscreen")
        text = el.get_text(strip=True) if el else None
        if not text:
            whole = card.select_one(".a-price-whole")
            if whole:
                text = whole.get_text(strip=True)
        if not text:
            return None

        match = PRICE_RE.search(text.replace(",", ""))
        if not match:
            return None
        try:
            return float(match.group(0))
        except ValueError:
            return None
