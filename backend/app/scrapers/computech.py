"""Scraper for Computech (computechstore.in).

Computech runs a Next.js SPA backed by a custom internal API
(``/api/products/public``). The API itself is firewalled (403 to plain
``requests`` and even to same-origin ``fetch`` from Playwright — likely
gated to the Next.js server-side renderer with a CSRF / JWT pair we can't
easily mint).

What the public site DOES expose: the homepage and category pages are
fully server-side-rendered. The homepage HTML alone contains ~120 product
cards with title, sale price, MRP, and absolute slug — all in plain HTML.
Category pages (``/category/<slug>``) extend that further. We just walk
those pages and parse the cards.

Site.config schema (all optional):
    {
        "extra_pages": ["/category/laptops", "/category/processor", ...],
        "request_timeout": 25
    }

The homepage is always scraped; ``extra_pages`` are added on top.
"""
from __future__ import annotations

import logging
import re
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
PRICE_RE = re.compile(r"₹\s*([\d,]+)")


class ComputechScraper(BaseScraper):
    def scrape(self) -> ScrapeResult:
        result = ScrapeResult()
        config = self.site.config or {}
        timeout = int(config.get("request_timeout", 25))
        extra_pages: list[str] = config.get("extra_pages") or []

        # Always scrape homepage; add any configured extra pages.
        page_paths = ["/"] + list(extra_pages)

        headers = {"User-Agent": self.site.user_agent or DEFAULT_UA}
        seen_urls: set[str] = set()

        for path in page_paths:
            page_url = urljoin(self.site.base_url.rstrip("/") + "/", path.lstrip("/"))
            try:
                resp = requests.get(page_url, headers=headers, timeout=timeout)
            except requests.RequestException as exc:
                result.errors.append(f"{page_url}: {exc}")
                continue

            if resp.status_code >= 400:
                result.errors.append(f"{page_url}: HTTP {resp.status_code}")
                continue

            page_added = self._parse_html(resp.text, seen_urls, result, source=path)
            log.info(
                "Computech scrape: %s — added %d (running=%d)",
                page_url, page_added, len(result.items),
            )

        log.info(
            "Computech scrape: %s — %d unique items, %d errors",
            self.site.name, len(result.items), len(result.errors),
        )
        return result

    def _parse_html(
        self,
        html: str,
        seen_urls: set[str],
        result: ScrapeResult,
        source: str,
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
