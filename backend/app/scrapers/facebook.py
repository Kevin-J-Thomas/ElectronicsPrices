"""Facebook Marketplace scraper.

Caveats (read before enabling this site):
    * Automating Facebook violates their ToS — the account whose cookies you
      use can be soft-banned or permanently disabled. Use a throwaway.
    * Marketplace pages require a logged-in session for full data since 2023.
      Anonymous access shows a login wall but still leaks ~24 item links and
      a handful of prices on city/electronics category pages.
    * FB's DOM uses obfuscated class names that rotate. We anchor on the
      semantic `a[href*="/marketplace/item/"]` link and read the title from
      the inner image's alt attribute / link text and price from any
      currency-bearing span — both relatively stable signals.
    * Expect breakage. Re-check selectors every few weeks.

Two modes — auto-selected based on whether `cookies` is provided in config:

    1. Anonymous mode (no cookies):
       Walks `marketplace/<city>/<category>` pages for each (city, category)
       in config. Sparse data: titles in localized language, many cards
       missing price. Still useful for URL/title harvesting.

    2. Authenticated mode (cookies provided):
       Uses `marketplace/<city>/search/?query=<term>` with the session
       cookies injected. Richer payload — prices, full titles, addresses.

Site.config schema:
    {
        # ---- common ----
        "locations":   ["mumbai", "bangalore", "delhi"],   # FB city slugs
        "categories":  ["electronics", "computers", "laptops"],
        "settle_ms":   4000,
        "scroll_passes": 3,
        "max_items_per_page": 60,

        # ---- authenticated mode (optional) ----
        "cookies": [                      # paste from devtools after login
            {"name": "c_user", "value": "...", "domain": ".facebook.com",
             "path": "/", "secure": true, "httpOnly": false},
            {"name": "xs",     "value": "...", "domain": ".facebook.com",
             "path": "/", "secure": true, "httpOnly": true}
        ],
        "search_terms": ["laptop", "ssd", "graphics card"],
        "max_items_per_term": 30,
        "radius_km": 40
    }
"""
from __future__ import annotations

import logging
import re
from urllib.parse import quote_plus, urljoin

from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

from app.scrapers.base import BaseScraper, ScrapedItem, ScrapeResult

log = logging.getLogger(__name__)

DEFAULT_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)
PRICE_RE = re.compile(r"(?:₹|Rs\.?|INR)\s*([\d,]+\.?\d*)", re.IGNORECASE)
ITEM_LINK_SEL = 'a[href*="/marketplace/item/"]'
ITEM_ID_RE = re.compile(r"/marketplace/item/(\d+)")
DEFAULT_CITIES = ["mumbai", "bangalore", "delhi", "hyderabad", "chennai"]
DEFAULT_CATEGORIES = ["electronics", "computers", "laptops"]


class FacebookMarketplaceScraper(BaseScraper):
    """Facebook Marketplace scraper with anonymous + authenticated modes.

    Anonymous mode is auto-selected when no cookies are provided; it walks
    the public city/category pages and harvests whatever leaks past the
    login wall. Authenticated mode kicks in when cookies are supplied and
    uses the search endpoint with full session.
    """

    def scrape(self) -> ScrapeResult:
        result = ScrapeResult()
        config = self.site.config or {}
        cookies = config.get("cookies") or []

        ua = self.site.user_agent or DEFAULT_UA

        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            context = browser.new_context(
                user_agent=ua,
                viewport={"width": 1440, "height": 900},
                locale="en-IN",
            )
            if cookies:
                try:
                    context.add_cookies(self._normalize_cookies(cookies))
                except Exception as exc:
                    result.errors.append(f"Failed to inject cookies: {exc}")
                    browser.close()
                    return result

            page = context.new_page()

            try:
                if cookies:
                    self._scrape_authenticated(page, config, result)
                else:
                    self._scrape_anonymous(page, config, result)
            finally:
                browser.close()

        log.info(
            "FB Marketplace: %s — %d unique items, %d errors",
            self.site.name, len(result.items), len(result.errors),
        )
        return result

    # ---------- Anonymous mode ------------------------------------------------

    def _scrape_anonymous(self, page, config: dict, result: ScrapeResult) -> None:
        cities: list[str] = config.get("locations") or DEFAULT_CITIES
        categories: list[str] = (
            config.get("categories") or self.categories or DEFAULT_CATEGORIES
        )
        scroll_passes = int(config.get("scroll_passes", 3))
        settle_ms = int(config.get("settle_ms", 4000))
        max_items = int(config.get("max_items_per_page", 60))

        seen_urls: set[str] = set()
        base = self.site.base_url.rstrip("/") + "/"
        # Strip /marketplace/ from base so we don't double-up
        if base.endswith("/marketplace/"):
            root = base[: -len("/marketplace/")]
        else:
            root = base.rstrip("/")
        marketplace_root = root + "/marketplace/"

        for city in cities:
            for category in categories:
                url = urljoin(marketplace_root, f"{city}/{category}")
                try:
                    items = self._scrape_page(
                        page, url, category=category, max_items=max_items,
                        scroll_passes=scroll_passes, settle_ms=settle_ms,
                        anonymous=True,
                    )
                except Exception as exc:
                    log.exception("FB anon scrape failed for %s", url)
                    result.errors.append(f"{url}: {exc}")
                    continue

                for item in items:
                    if item.url in seen_urls:
                        continue
                    seen_urls.add(item.url)
                    result.items.append(item)

        if not result.items and not result.errors:
            result.errors.append(
                "Anonymous mode returned 0 listings — FB login wall likely "
                "stripped all prices. Provide 'cookies' in config to unlock "
                "richer data via authenticated search endpoint."
            )

    # ---------- Authenticated mode --------------------------------------------

    def _scrape_authenticated(
        self, page, config: dict, result: ScrapeResult,
    ) -> None:
        search_terms: list[str] = (
            config.get("search_terms") or self.categories or []
        )
        location_slug = config.get("location_slug") or (
            (config.get("locations") or [None])[0]
        )
        max_items = int(config.get("max_items_per_term", 30))
        scroll_passes = int(config.get("scroll_passes", 3))
        settle_ms = int(config.get("settle_ms", 1500))
        radius_km = int(config.get("radius_km", 40))

        if not search_terms:
            result.errors.append(
                "Authenticated mode needs 'search_terms' (or site categories)"
            )
            return
        if not location_slug and not self.location:
            result.errors.append(
                "Authenticated mode needs 'location_slug' / 'locations[0]' "
                "or (lat, lon, radius) at construction"
            )
            return

        seen_urls: set[str] = set()
        for term in search_terms:
            search_url = self._build_search_url(term, location_slug, radius_km)
            try:
                items = self._scrape_page(
                    page, search_url, category=term, max_items=max_items,
                    scroll_passes=scroll_passes, settle_ms=settle_ms,
                    anonymous=False,
                )
            except Exception as exc:
                log.exception("FB auth scrape failed for term=%s", term)
                result.errors.append(f"{search_url}: {exc}")
                continue

            for item in items:
                if item.url in seen_urls:
                    continue
                seen_urls.add(item.url)
                result.items.append(item)

    # ---------- Shared helpers ------------------------------------------------

    def _build_search_url(
        self, term: str, location_slug: str | None, radius_km: int,
    ) -> str:
        base = self.site.base_url.rstrip("/") + "/"
        if base.endswith("/marketplace/"):
            root = base[: -len("/marketplace/")] + "/"
        else:
            root = base
        if self.location:
            lat, lon, radius = self.location
            return urljoin(
                root,
                f"marketplace/search/?query={quote_plus(term)}"
                f"&latitude={lat}&longitude={lon}&radius={int(radius)}"
                f"&exact=false",
            )
        return urljoin(
            root,
            f"marketplace/{location_slug}/search/?query={quote_plus(term)}"
            f"&radius={radius_km}&exact=false",
        )

    def _scrape_page(
        self,
        page,
        url: str,
        *,
        category: str,
        max_items: int,
        scroll_passes: int,
        settle_ms: int,
        anonymous: bool,
    ) -> list[ScrapedItem]:
        page.goto(url, wait_until="domcontentloaded", timeout=45000)

        # Authenticated mode: redirect to /login means stale cookies.
        # Anonymous mode: login wall is overlaid but item links still render.
        if not anonymous and (
            "/login" in page.url or "login.php" in page.url
        ):
            raise RuntimeError(
                "Redirected to /login — cookies expired, re-export from a "
                "fresh logged-in browser session"
            )

        try:
            page.wait_for_selector(ITEM_LINK_SEL, timeout=15000)
        except PWTimeout:
            return []

        for _ in range(scroll_passes):
            page.evaluate("window.scrollBy(0, document.body.scrollHeight)")
            page.wait_for_timeout(settle_ms)

        items: list[ScrapedItem] = []
        for el in page.query_selector_all(ITEM_LINK_SEL)[:max_items]:
            href = el.get_attribute("href") or ""
            if "/marketplace/item/" not in href:
                continue
            item_url = self._canonical_url(href)
            if item_url is None:
                continue

            text = (el.inner_text() or "").strip()
            price = self._parse_price(text)

            # In anonymous mode many cards have no visible price; still
            # capture title-only entries with price=0 so URL harvesting works
            # — but we have to skip them for save() since price>0 is enforced
            # downstream. Better: skip anon entries with no price.
            if price is None:
                continue

            title = self._extract_title(el, text)
            if not title:
                continue

            items.append(
                ScrapedItem(
                    title=title[:500],
                    url=item_url,
                    price=price,
                    currency="INR",
                    condition="used",
                    category=category,
                )
            )
        return items

    @staticmethod
    def _canonical_url(href: str) -> str | None:
        match = ITEM_ID_RE.search(href)
        if not match:
            return None
        return f"https://www.facebook.com/marketplace/item/{match.group(1)}"

    @staticmethod
    def _normalize_cookies(cookies: list[dict]) -> list[dict]:
        normalized = []
        for c in cookies:
            if "name" not in c or "value" not in c:
                continue
            entry = {
                "name": c["name"],
                "value": c["value"],
                "domain": c.get("domain", ".facebook.com"),
                "path": c.get("path", "/"),
                "secure": bool(c.get("secure", True)),
                "httpOnly": bool(c.get("httpOnly", False)),
            }
            if "expires" in c:
                entry["expires"] = c["expires"]
            normalized.append(entry)
        return normalized

    @staticmethod
    def _parse_price(text: str) -> float | None:
        match = PRICE_RE.search(text)
        if not match:
            return None
        try:
            return float(match.group(1).replace(",", ""))
        except ValueError:
            return None

    @staticmethod
    def _extract_title(el, fallback_text: str) -> str | None:
        img = el.query_selector("img[alt]")
        if img:
            alt = (img.get_attribute("alt") or "").strip()
            if alt:
                return alt
        # FB often renders the title as the last meaningful line of the link.
        lines = [
            ln.strip() for ln in fallback_text.splitlines()
            if ln.strip() and not PRICE_RE.search(ln)
        ]
        return lines[-1] if lines else None
