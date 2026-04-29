"""SMCInternational scraper.

The site (smcinternational.in) renders category landing pages as a static
shell, then fetches products via a POST AJAX call against
``/home/fetch_data/{page}`` with form data identifying the catid (category id).

The static HTML scraper only sees the empty shell, so we hit the AJAX
endpoint directly and parse the returned ``product_list`` HTML fragment.

Each card has:
- An anchor with the canonical product URL
- A truncated title in ``a.plist-heading-light`` (with trailing "...")
- An offer/sale price in ``p.plist-price`` and original price in
  ``p.plist-original-price``
- A modal sibling whose ``h2.quick-heading`` carries the full untruncated
  title — we prefer that.
"""
from __future__ import annotations

import logging
import re
import time
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

from app.scrapers.base import BaseScraper, ScrapedItem, ScrapeResult

log = logging.getLogger(__name__)

DEFAULT_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/125.0.0.0 Safari/537.36"
)
PRICE_RE = re.compile(r"[\d,]+\.?\d*")
MODAL_ID_RE = re.compile(r"#myModal(\d+)")


class SMCInternationalScraper(BaseScraper):
    """Driven by Site.config — supports per-category catid + pagination.

    Expected config:
        {
          "category_catids": {"processors": 18, "motherboard": 3, ...},
          "max_pages": 5,
          "request_timeout": 25
        }

    Optional ``categories`` filter (list of category names) honored.
    """

    AJAX_PATH = "/home/fetch_data/{page}"

    def scrape(self) -> ScrapeResult:
        result = ScrapeResult()
        config = self.site.config or {}
        category_catids: dict = config.get("category_catids") or {}
        max_pages = int(config.get("max_pages", 5))
        timeout_s = float(config.get("request_timeout", 25))
        delay = float(config.get("request_delay", 0.4))

        if not category_catids:
            result.errors.append(
                f"Site '{self.site.name}' missing 'category_catids' in config"
            )
            return result

        target = self.categories or list(category_catids.keys())

        headers = {
            "User-Agent": self.site.user_agent or DEFAULT_UA,
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Origin": self.site.base_url.rstrip("/"),
            "Referer": self.site.base_url.rstrip("/") + "/",
        }
        timeout = httpx.Timeout(timeout_s, connect=10.0)
        seen_urls: set[str] = set()

        with httpx.Client(headers=headers, timeout=timeout, follow_redirects=True) as client:
            for category in target:
                catid = category_catids.get(category)
                if catid in (None, ""):
                    result.errors.append(f"No catid mapping for '{category}'")
                    continue

                for page in range(1, max_pages + 1):
                    url = urljoin(
                        self.site.base_url.rstrip("/") + "/",
                        self.AJAX_PATH.lstrip("/").format(page=page),
                    )
                    form = {
                        "action": "fetch_data",
                        "catid": str(catid),
                        "catnam": "",
                        "slug": "",
                    }
                    try:
                        resp = client.post(url, data=form)
                        resp.raise_for_status()
                        payload = resp.json()
                    except Exception as exc:
                        result.errors.append(f"{category} p{page}: {exc}")
                        break

                    fragment = (payload or {}).get("product_list") or ""
                    if not fragment.strip():
                        break

                    new_items = self._parse_fragment(fragment, category)
                    if not new_items:
                        break

                    added = 0
                    for item in new_items:
                        if item.url in seen_urls:
                            continue
                        seen_urls.add(item.url)
                        result.items.append(item)
                        added += 1

                    log.info(
                        "SMC %s page=%d catid=%s parsed=%d new=%d",
                        category, page, catid, len(new_items), added,
                    )

                    # Early exit if pagination indicates last page
                    pag = (payload or {}).get("pagination_link") or ""
                    if "rel=\"next\"" not in pag and "rel='next'" not in pag:
                        break

                    if delay > 0:
                        time.sleep(delay)

        log.info("SMC: %d items, %d errors", len(result.items), len(result.errors))
        return result

    # ------------------------------------------------------------------
    def _parse_fragment(self, html: str, category: str) -> list[ScrapedItem]:
        soup = BeautifulSoup(html, "lxml")

        # Build modal_id -> full title map from quick-view modals
        modal_titles: dict[str, str] = {}
        for modal in soup.select(".modal.quick-view-comp, .modal.fade.quick-view-comp"):
            mid = (modal.get("id") or "").replace("myModal", "")
            heading = modal.select_one("h2.quick-heading")
            if mid and heading:
                t = heading.get_text(" ", strip=True)
                if t:
                    modal_titles[mid] = t

        items: list[ScrapedItem] = []
        for box in soup.select(".p-grid-box"):
            link_el = box.select_one("a.plist-heading-light")
            if not link_el:
                continue
            href = (link_el.get("href") or "").strip()
            if not href:
                continue
            # Site emits URLs like "https://smcinternational.in//slug/handle"
            href = re.sub(r"(?<!:)//+", "/", href)
            item_url = urljoin(self.site.base_url, href)

            # Pull modal id to look up the full untruncated title
            quick = box.select_one("button.btn-quick-view")
            full_title = ""
            if quick:
                target = quick.get("data-target") or ""
                m = MODAL_ID_RE.search(target)
                if m:
                    full_title = modal_titles.get(m.group(1), "")
            if not full_title:
                full_title = link_el.get_text(" ", strip=True)
                full_title = re.sub(r"\.{2,}\s*$", "", full_title).strip()
            if not full_title:
                continue

            # Prefer offer (.plist-price); fall back to original
            price = None
            for sel in ("p.plist-price", "p.plist-original-price"):
                pe = box.select_one(sel)
                if pe:
                    price = self._parse_price(pe.get_text(" ", strip=True))
                    if price is not None:
                        break
            if price is None or price <= 0:
                continue

            items.append(
                ScrapedItem(
                    title=full_title[:300],
                    url=item_url,
                    price=price,
                    currency="INR",
                    condition="new",
                    category=category,
                )
            )
        return items

    @staticmethod
    def _parse_price(text: str) -> float | None:
        m = PRICE_RE.search(text.replace(",", ""))
        if not m:
            return None
        try:
            return float(m.group(0).replace(",", ""))
        except ValueError:
            return None
