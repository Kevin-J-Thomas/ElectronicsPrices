import re
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

from app.scrapers.base import BaseScraper, ScrapedItem, ScrapeResult

DEFAULT_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/125.0.0.0 Safari/537.36"
)

PRICE_RE = re.compile(r"[\d,]+\.?\d*")


class StaticHtmlScraper(BaseScraper):
    """
    Works for sites that render product listings as server-side HTML.

    Driven entirely by Site.config JSON — no code changes needed per site.
    Expected config keys:
        {
          "category_urls": {"ssds": "/collections/ssd", ...},
          "selectors": {
            "product_item": ".grid-product",
            "title":        ".grid-product__title",
            "url":          ".grid-product__link",
            "price":        ".grid-product__price"
          },
          "pagination_pattern": "?page={page}",
          "max_pages": 5
        }
    """

    def scrape(self) -> ScrapeResult:
        result = ScrapeResult()
        config = self.site.config or {}
        selectors = config.get("selectors") or {}
        category_urls = config.get("category_urls") or {}
        max_pages = int(config.get("max_pages", 3))
        pagination_pattern = config.get("pagination_pattern", "?page={page}")

        if not selectors or not category_urls:
            result.errors.append(
                f"Site '{self.site.name}' has no scraper config yet — "
                "set 'selectors' and 'category_urls' in the admin panel"
            )
            return result

        required = ("product_item", "title", "url", "price")
        missing = [k for k in required if k not in selectors]
        if missing:
            result.errors.append(f"Missing selector keys: {missing}")
            return result

        headers = {"User-Agent": self.site.user_agent or DEFAULT_UA}
        target_categories = self.categories or list(category_urls.keys())
        timeout = httpx.Timeout(30.0, connect=10.0)

        with httpx.Client(headers=headers, timeout=timeout, follow_redirects=True) as client:
            for category in target_categories:
                url_path = category_urls.get(category)
                if not url_path:
                    result.errors.append(f"No URL mapping for category '{category}'")
                    continue
                category_url = urljoin(self.site.base_url, url_path)

                for page in range(1, max_pages + 1):
                    page_url = (
                        category_url if page == 1
                        else category_url + pagination_pattern.format(page=page)
                    )
                    try:
                        items = self._scrape_page(client, page_url, selectors, category)
                    except Exception as exc:
                        result.errors.append(f"{page_url}: {exc}")
                        break
                    if not items:
                        break
                    result.items.extend(items)

        return result

    def _scrape_page(
        self,
        client: httpx.Client,
        url: str,
        selectors: dict,
        category: str,
    ) -> list[ScrapedItem]:
        resp = client.get(url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")

        items: list[ScrapedItem] = []
        for el in soup.select(selectors["product_item"]):
            title_el = el.select_one(selectors["title"])
            # Empty url-selector → use the wrapper itself if it's a link.
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
        if el.get("title"):
            return el["title"].strip()
        if el.get("alt"):
            return el["alt"].strip()
        inner = el.select_one("[title]")
        if inner and inner.get("title"):
            return inner["title"].strip()
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
