import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

from app.scrapers.base import BaseScraper, ScrapedItem, ScrapeResult

DEFAULT_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/125.0.0.0 Safari/537.36"
)
PRICE_RE = re.compile(r"[\d,]+\.?\d*")


class DynamicHtmlScraper(BaseScraper):
    """
    For JS-rendered sites (Amazon, Flipkart, HP, Dell, Lenovo, Acer, ASUS).
    Uses Playwright (headless Chromium) to render the page, then parses with BeautifulSoup.

    Config same as StaticHtmlScraper, plus optional:
        - wait_selector:     CSS selector to wait for before reading DOM
        - scroll_to_bottom:  bool — scroll to load lazy-loaded items (default true)
        - settle_ms:         extra wait after scroll (default 1500 ms)
    """

    def scrape(self) -> ScrapeResult:
        result = ScrapeResult()
        config = self.site.config or {}
        selectors = config.get("selectors") or {}
        category_urls = config.get("category_urls") or {}
        max_pages = int(config.get("max_pages", 2))
        wait_selector = config.get("wait_selector")
        scroll_to_bottom = config.get("scroll_to_bottom", True)
        settle_ms = int(config.get("settle_ms", 1500))
        pagination_pattern = config.get("pagination_pattern", "?page={page}")

        if not selectors or not category_urls:
            result.errors.append(
                f"Site '{self.site.name}' has no scraper config — "
                "set 'selectors' and 'category_urls' in admin"
            )
            return result

        required = ("product_item", "title", "url", "price")
        missing = [k for k in required if k not in selectors]
        if missing:
            result.errors.append(f"Missing selector keys: {missing}")
            return result

        target_categories = self.categories or list(category_urls.keys())
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
            page = context.new_page()

            for category in target_categories:
                url_path = category_urls.get(category)
                if not url_path:
                    result.errors.append(f"No URL mapping for category '{category}'")
                    continue
                cat_url = urljoin(self.site.base_url, url_path)

                for page_num in range(1, max_pages + 1):
                    page_url = (
                        cat_url if page_num == 1
                        else cat_url + pagination_pattern.format(page=page_num)
                    )
                    try:
                        items = self._scrape_page(
                            page, page_url, selectors, category,
                            wait_selector, scroll_to_bottom, settle_ms,
                        )
                    except Exception as exc:
                        result.errors.append(f"{page_url}: {exc}")
                        break
                    if not items:
                        break
                    result.items.extend(items)

            browser.close()

        return result

    def _scrape_page(
        self,
        page,
        url: str,
        selectors: dict,
        category: str,
        wait_selector: str | None,
        scroll_to_bottom: bool,
        settle_ms: int,
    ) -> list[ScrapedItem]:
        page.goto(url, wait_until="domcontentloaded", timeout=45000)

        wait_target = wait_selector or selectors["product_item"]
        try:
            page.wait_for_selector(wait_target, timeout=15000)
        except PWTimeout:
            pass  # continue anyway — site may have content but selector mismatch

        if scroll_to_bottom:
            page.evaluate(
                "async () => {"
                "  await new Promise((r) => {"
                "    let t = 0;"
                "    const i = setInterval(() => {"
                "      window.scrollBy(0, 800);"
                "      t += 800;"
                "      if (t >= document.body.scrollHeight) { clearInterval(i); r(); }"
                "    }, 200);"
                "  });"
                "}"
            )
            page.wait_for_timeout(settle_ms)

        html = page.content()
        soup = BeautifulSoup(html, "lxml")

        items: list[ScrapedItem] = []
        for el in soup.select(selectors["product_item"]):
            title_el = el.select_one(selectors["title"])
            # Allow the wrapper itself to be the URL anchor — for sites where
            # each product is a single <a> with everything inside it (e.g.
            # GameNation's <a class="product-card-1">). Use empty string in
            # selectors.url to opt in.
            url_sel = selectors.get("url") or ""
            if url_sel:
                link_el = el.select_one(url_sel)
            else:
                link_el = el if el.name == "a" and el.get("href") else None
            price_el = el.select_one(selectors["price"])
            if not (title_el and link_el and price_el):
                continue

            price = self._parse_price(price_el.get_text(" ", strip=True))
            if price is None:
                continue

            href = link_el.get("href") or ""
            item_url = urljoin(self.site.base_url, href)

            items.append(
                ScrapedItem(
                    title=self._extract_title(title_el),
                    url=item_url,
                    price=price,
                    category=category,
                )
            )
        return items

    @staticmethod
    def _extract_title(el) -> str:
        # Prefer the element's own title/alt (works for <img alt="...">)
        if el.get("title"):
            return el["title"].strip()
        if el.get("alt"):
            return el["alt"].strip()
        # Then an inner span[title] (WooCommerce / PCStudio)
        inner = el.select_one("[title]")
        if inner and inner.get("title"):
            return inner["title"].strip()
        # Then an inner img[alt] (Flipkart / many marketplaces)
        inner_img = el.select_one("img[alt]")
        if inner_img and inner_img.get("alt"):
            return inner_img["alt"].strip()
        return el.get_text(" ", strip=True)

    @staticmethod
    def _parse_price(text: str) -> float | None:
        match = PRICE_RE.search(text.replace(",", ""))
        if not match:
            return None
        try:
            return float(match.group(0).replace(",", ""))
        except ValueError:
            return None
