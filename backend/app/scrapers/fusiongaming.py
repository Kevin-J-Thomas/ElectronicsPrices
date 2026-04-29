"""FusionGaming scraper — handles their non-standard card layout.

The /accessories page renders product cards via a React SPA after decoding an
encrypted API response. Cards have:
- An image with the product name embedded in the filename
- A sibling div with title + price extracted via regex from text content
- No anchor link to a product detail page

We use the image URL (which is unique per product) as the canonical listing URL,
and parse the title from the image filename. Prices come from the sibling text
matching `Price: ₹ N,NNN`.
"""
from __future__ import annotations

import logging
import re
from urllib.parse import unquote, urljoin

from app.scrapers.base import BaseScraper, ScrapedItem, ScrapeResult

log = logging.getLogger(__name__)

DEFAULT_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0 Safari/537.36"
)
PRICE_RE = re.compile(r"Price\s*:\s*₹\s*([\d,]+)", re.IGNORECASE)
PRICE_FALLBACK_RE = re.compile(r"₹\s*([\d,]+)")


class FusionGamingScraper(BaseScraper):
    def scrape(self) -> ScrapeResult:
        result = ScrapeResult()
        config = self.site.config or {}
        category_paths: dict[str, str] = config.get("category_urls") or {
            "accessories": "/accessories",
        }
        settle_ms = int(config.get("settle_ms", 12000))

        # Lazy import so static-only workers don't pull in Playwright.
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            ctx = browser.new_context(
                user_agent=self.site.user_agent or DEFAULT_UA,
                viewport={"width": 1440, "height": 900},
                locale="en-IN",
            )
            page = ctx.new_page()
            seen: set[str] = set()

            for category, path in category_paths.items():
                url = urljoin(self.site.base_url.rstrip("/") + "/", path.lstrip("/"))
                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(settle_ms)
                    # Trigger lazy-loads
                    page.evaluate(
                        "async () => { "
                        "  await new Promise(r => { let t=0; const i=setInterval(() => { "
                        "    window.scrollBy(0,500); t+=500; "
                        "    if (t>=document.body.scrollHeight) { clearInterval(i); r(); } "
                        "  }, 200); }); "
                        "}"
                    )
                    page.wait_for_timeout(2500)

                    # Each card is wrapped in .mt-2.p-3.col-lg-8 which contains
                    # title + description + price text + an inner .card.border-danger
                    # that holds the image.
                    cards = page.evaluate(
                        """() => {
                            const out = [];
                            for (const w of document.querySelectorAll('.mt-2.p-3.col-lg-8')) {
                                const text = (w.innerText || '').trim();
                                if (!text || !/₹/.test(text)) continue;
                                const img = w.parentElement?.querySelector('.card img')
                                         || w.querySelector('img');
                                out.push({
                                    text: text,
                                    imgSrc: img?.src || '',
                                });
                            }
                            return out;
                        }"""
                    )
                except Exception as exc:
                    result.errors.append(f"FusionGaming {url}: {exc}")
                    continue

                log.info("FusionGaming: %s — %d card(s) rendered", category, len(cards))

                for c in cards:
                    item = self._parse_card(c, category)
                    if item and item.url not in seen:
                        seen.add(item.url)
                        result.items.append(item)

            browser.close()

        log.info(
            "FusionGaming: %d unique items, %d errors",
            len(result.items), len(result.errors),
        )
        return result

    @staticmethod
    def _parse_card(card: dict, category: str) -> ScrapedItem | None:
        text = (card.get("text") or "").strip()
        img_src = card.get("imgSrc") or ""
        if not text or not img_src:
            return None

        # Title: prefer first non-empty line of card text (visible product name)
        title = ""
        for line in text.split("\n"):
            line = line.strip()
            if line and not line.lower().startswith(("price", "add to cart", "standard ")):
                title = line
                break
        # Fallback: derive from image filename
        if not title:
            fname = img_src.rsplit("/", 1)[-1].rsplit(".", 1)[0]
            title = unquote(fname).strip()
        if not title:
            return None

        # Price: prefer "Price: ₹..." pattern, else first ₹ amount.
        m = PRICE_RE.search(text) or PRICE_FALLBACK_RE.search(text)
        if not m:
            return None
        try:
            price = float(m.group(1).replace(",", ""))
        except ValueError:
            return None
        if price <= 0:
            return None

        return ScrapedItem(
            title=title[:300],
            url=img_src,  # image URL is unique per product
            price=price,
            currency="INR",
            condition="new",
            category=category,
        )
