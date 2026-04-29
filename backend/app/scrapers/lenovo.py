"""Lenovo India scraper.

The standard DynamicHtmlScraper hits a buffer issue on Lenovo's 3 MB+ rendered
pages — `page.content()` returns empty inside the Celery worker context (works
fine in standalone Python). To avoid the HTML transfer, this scraper extracts
products directly via `page.evaluate()`, returning structured data from the
browser's DOM.

Lenovo's product listing pages (`/d/legion`, `/d/thinkpad`, `/pc/laptops`) use
`li.product_item` wrappers with title in the anchor text and the sale price in
`span.price-title`.
"""
from __future__ import annotations

import logging
import time
from urllib.parse import urlparse

from app.scrapers.base import BaseScraper, ScrapedItem, ScrapeResult

log = logging.getLogger(__name__)

DEFAULT_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
)

DEFAULT_CATEGORY_URLS = {
    # Main series landing pages — high product counts.
    "legion":            "/in/en/d/legion",
    "thinkpad":          "/in/en/d/thinkpad",
    "ideapad":           "/in/en/d/ideapad",
    "thinkbook":         "/in/en/d/thinkbook",
    # ThinkBook sub-series.
    "thinkbook-14":      "/in/en/d/thinkbook-14",
    "thinkbook-16":      "/in/en/d/thinkbook-16",
    # Other laptop families. (loq needs a longer settle than /d/ pages.)
    "loq":               "/in/en/c/laptops/loq-laptops/",
    # Desktops, workstations.
    "desktops":          "/in/en/d/desktops",
    "thinkcentre":       "/in/en/c/desktops/thinkcentre",
    "workstations":      "/in/en/d/workstations",
    "thinkstation":      "/in/en/c/workstations/thinkstationp/",
    # Other categories.
    "gaming":            "/in/en/d/gaming",
    "accessories":       "/in/en/d/accessories",
    # NOTE: yoga, handheld, /pc/laptops, tablets, and thinkpad-{x,t,p,l,e,x9}
    # were probed and removed:
    #  - yoga, handheld, /pc/laptops -> marketing/landing pages, no product cards.
    #  - tablets -> uses an entirely different card structure (.product_card with
    #    no /p/ anchor) — only 3-4 SKUs, not worth a parallel parser.
    #  - thinkpad-{x,t,p,l,e,x9} -> the SPA returns the parent ThinkPad
    #    listing for all six sub-series URLs (URL-deduped, contributes nothing).
}


class LenovoScraper(BaseScraper):
    def scrape(self) -> ScrapeResult:
        result = ScrapeResult()
        config = self.site.config or {}
        category_urls: dict[str, str] = (
            config.get("category_urls") or DEFAULT_CATEGORY_URLS
        )
        # Bumped from 8000 -> 15000ms: probing showed loq, desktops,
        # thinkcentre, accessories all return 0 cards at 8s but render
        # 6/40-60/20/60 cards once they get ~15s to settle. Other working
        # categories tolerate the extra time without issue.
        settle_ms = int(config.get("settle_ms", 15000))

        from playwright.sync_api import sync_playwright

        # Inter-category delay (seconds) — back-to-back requests against
        # /d/ and /c/ paths can produce 0-card renders. A small pause
        # between categories noticeably improves the hit rate.
        inter_category_delay_s = float(config.get("inter_category_delay_s", 3.0))
        # If a category renders 0 cards, retry with a fresh browser
        # (max_retries times) before giving up.
        max_retries = int(config.get("max_retries", 2))

        # Resolve URLs against the bare origin. If we used urljoin against
        # base_url="https://www.lenovo.com/in/en/" with absolute-looking
        # paths "/in/en/d/legion", we'd get "/in/en/in/en/d/legion" —
        # Lenovo accepts the doubled path but it's confusing in logs.
        parsed = urlparse(self.site.base_url)
        origin = f"{parsed.scheme}://{parsed.netloc}"

        seen: set[str] = set()
        with sync_playwright() as p:
            for idx, (category, path) in enumerate(category_urls.items()):
                if idx > 0 and inter_category_delay_s > 0:
                    time.sleep(inter_category_delay_s)

                url = origin + "/" + path.lstrip("/")
                products = self._scrape_category(
                    p, url, settle_ms, max_retries
                )
                log.info(
                    "Lenovo: %s — %d cards rendered",
                    category, len(products),
                )
                for raw in products:
                    item = self._parse_card(raw, category)
                    if item and item.url not in seen:
                        seen.add(item.url)
                        result.items.append(item)

        log.info(
            "Lenovo: %d unique items, %d errors",
            len(result.items), len(result.errors),
        )
        return result

    def _scrape_category(
        self,
        playwright_ctx,
        url: str,
        settle_ms: int,
        max_retries: int,
    ) -> list:
        """Scrape one category. Retries with a fresh browser if 0 cards
        materialise — Lenovo's CDN intermittently serves a non-product
        marketing render even on URLs that normally list products.
        """
        last_products: list = []
        for attempt in range(max_retries + 1):
            browser = playwright_ctx.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            ctx = browser.new_context(
                user_agent=self.site.user_agent or DEFAULT_UA,
                viewport={"width": 1440, "height": 900},
                locale="en-IN",
            )
            page = ctx.new_page()
            page.wait_for_timeout(500)
            products: list = []
            try:
                # All Lenovo /d/ and /c/ URLs 301 to /<segment>/?cid=
                # flash_redirect — that IS the normal serving flow. We do
                # NOT treat a flash_redirect URL as failure: the redirect
                # target is the actual product listing page.
                page.goto(url, wait_until="domcontentloaded", timeout=45000)
                try:
                    page.wait_for_selector(
                        "li.product_item span.price-title", timeout=30000
                    )
                except Exception:
                    pass
                # Force lazy-loads — the SPA only renders past the first
                # ~10 cards once the scroll triggers an IntersectionObserver.
                page.evaluate(
                    "async () => { "
                    "  await new Promise(r => { let t=0; const i=setInterval(() => { "
                    "    window.scrollBy(0,600); t+=600; "
                    "    if (t>=document.body.scrollHeight) { clearInterval(i); r(); } "
                    "  }, 200); }); "
                    "}"
                )
                page.wait_for_timeout(settle_ms)
                products = page.evaluate(
                    """() => {
                        const out = [];
                        for (const it of document.querySelectorAll('li.product_item')) {
                            const a = it.querySelector('a[href*="/p/"]');
                            if (!a) continue;
                            const title = (a.innerText || '').trim();
                            if (!title) continue;
                            const priceEl = it.querySelector('span.price-title');
                            if (!priceEl) continue;
                            const priceText = (priceEl.innerText || '').trim();
                            out.push({title, href: a.href, price: priceText});
                        }
                        return out;
                    }"""
                )
            except Exception as exc:
                log.warning("Lenovo attempt %d for %s: %s", attempt + 1, url, exc)
            finally:
                try:
                    ctx.close()
                except Exception:
                    pass
                try:
                    browser.close()
                except Exception:
                    pass

            if products:
                return products
            if attempt < max_retries:
                # 0 cards — back off then retry with a fresh browser.
                time.sleep(5 + 3 * attempt)
                log.info(
                    "Lenovo %s rendered 0 cards; retry %d/%d",
                    url, attempt + 1, max_retries,
                )
                continue
            last_products = products
            break
        return last_products

    @staticmethod
    def _parse_card(raw: dict, category: str) -> ScrapedItem | None:
        import re

        title = (raw.get("title") or "").strip()
        href = (raw.get("href") or "").strip()
        price_text = (raw.get("price") or "").strip()
        if not title or not href:
            return None
        m = re.search(r"[\d,]+", price_text.replace(",", ""))
        if not m:
            return None
        try:
            price = float(m.group(0))
        except ValueError:
            return None
        if price <= 0:
            return None
        return ScrapedItem(
            title=title[:300],
            url=href,
            price=price,
            currency="INR",
            condition="new",
            category=category,
        )
