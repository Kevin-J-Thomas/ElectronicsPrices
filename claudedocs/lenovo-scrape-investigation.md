# Lenovo Scrape Investigation

## Outcome

Direct scraping of `lenovo.com/in/en/laptops/` is **not viable**. Static curl returns 200 with ~70 `₹` markers, but those are filter UI / banner copy strings (e.g. "Highest Saving by ₹") — there are zero product cards in the static HTML; the catalog is a hydrated SPA. Headless Playwright in the worker is hard-blocked by **Akamai edge bot detection**: the page returns HTTP 403 "Access Denied" with reference `errors.edgesuite.net` (302-byte HTML stub), so the HP Magento static pattern cannot apply and a vanilla Playwright fetch is also rejected.

Routed Lenovo through **Smartprix aggregator** instead — same approach as the working Acer config (site_id=29). `https://www.smartprix.com/laptops/lenovo-brand` and `/computers/lenovo-brand` render fine via the existing `DynamicHtmlScraper` and expose `.sm-product` cards with `a.name` / `span.price` selectors.

After PATCH and trigger, scrape returned **47 listings** (laptops + desktops). DB confirms `SELECT COUNT(*) FROM listings WHERE site='Lenovo'` → 47, with valid SKUs like "Lenovo IdeaPad Slim 3 83K100CJIN Laptop (...)" at ₹76,990. Lint clean (`ruff check app/`).

## Final Config (site_id=28)

```json
{
  "name": "Lenovo",
  "base_url": "https://www.smartprix.com/",
  "scraper_type": "dynamic",
  "enabled": true,
  "config": {
    "category_urls": {
      "laptops": "/laptops/lenovo-brand",
      "desktops": "/computers/lenovo-brand"
    },
    "selectors": {
      "product_item": ".sm-product",
      "title": "a.name",
      "url": "a.name",
      "price": "span.price"
    },
    "pagination_pattern": "?page={page}",
    "max_pages": 1,
    "wait_selector": ".sm-product",
    "scroll_to_bottom": true,
    "settle_ms": 3500
  },
  "categories": ["laptops", "desktops"]
}
```

## What Changed

- `base_url`: `https://www.lenovo.com/in/en/` → `https://www.smartprix.com/`
- `scraper_type`: `dynamic` (kept; static can't reach lenovo.com via curl-rendered cards)
- `enabled`: `false` → `true`
- `config`: empty → Smartprix `.sm-product` selector set
- `categories`: `[]` → `["laptops", "desktops"]`

## Notes / Follow-up

- Smartprix coverage: 28 laptop tiles + 28 desktop tiles on page 1; the dynamic scraper deduplicated to 47 unique URLs. Bumping `max_pages` to 2-3 should yield more if Smartprix paginates Lenovo brand pages further.
- Listing URLs point to smartprix.com PDPs (e.g. `/laptops/lenovo-...-ppd1wqaavfsf`) rather than lenovo.com — acceptable for price-tracking; raises the same blind-spot as Acer.
- This validates the pending umbrella task #19 ("CF-blocked sites via Smartprix aggregator") as the right pattern for any Akamai/Cloudflare-walled vendor (Lenovo, Acer already; potentially Dell variants, Apple).
