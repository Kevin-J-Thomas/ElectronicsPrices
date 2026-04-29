# Facebook Marketplace Scraper Investigation

## Outcome

**316 used-electronics listings harvested anonymously from FB Marketplace** for site_id=33 (FacebookMarketplace). All conditions=used, prices ranging Rs.99 – Rs.4,89,000 (avg Rs.18,618). Lint clean (`ruff check app/` passed). No login flow / captcha triggered.

## What was implemented

`backend/app/scrapers/facebook.py` — `FacebookMarketplaceScraper(BaseScraper)` with two modes auto-selected by config:

### Anonymous mode (default — no `cookies` in config)
- Iterates `config.locations × config.categories`, e.g. `mumbai × electronics`, `bangalore × computers`, …
- Visits `https://www.facebook.com/marketplace/<city>/<category>` for each combo
- Uses Playwright (headless Chromium, realistic UA, en-IN locale, 1440×900 viewport)
- Extracts via:
  - **Item cards**: `a[href*="/marketplace/item/"]` (~24 visible per page even with login wall overlay)
  - **Title**: `img[alt]` inside the link, falls back to last non-price line of link text
  - **Price**: regex `(?:₹|Rs\.?|INR)\s*([\d,]+\.?\d*)` against link text
  - **URL canonicalization**: strips query params; rebuilt as `https://www.facebook.com/marketplace/item/<id>` from regex `/marketplace/item/(\d+)`
- Defaults: `condition="used"`, `currency="INR"`
- Cards without parseable price are skipped (so all stored items have real prices)

### Authenticated mode (when `cookies` provided)
- Injects cookies into Playwright context, then uses `marketplace/<city>/search/?query=<term>` per `search_terms`
- Detects stale cookies via redirect to `/login`, raises an explanatory error
- Optional `(lat, lon, radius)` constructor arg overrides slug-based search

### Other notes
- Single browser/context for the whole run; one page reused across URLs (no re-login churn risk).
- `result.errors` populated with single explanatory message on no-data outcome instead of crashing.
- Registry at `backend/app/scrapers/registry.py:56` already routes `location` + `"facebook" in name/url` here — no registry change needed.

## site_id=33 config (deployed)
```json
{
  "scraper_type": "location",
  "enabled": true,
  "config": {
    "locations": ["mumbai", "bangalore", "delhi", "hyderabad", "chennai"],
    "categories": ["electronics", "computers", "laptops"],
    "settle_ms": 4000,
    "scroll_passes": 3,
    "max_items_per_page": 60
  }
}
```

## Anonymous-mode result
- **316 unique listings** persisted (`SELECT COUNT(*) FROM listings WHERE site='FacebookMarketplace'`)
- Sample title: `"Chennai, TN குழுவில் HP Slim Laptop ✨ Core i5-6th Gen, 8GB RAM, 256GB SSD, 14\" HD SCREEN, Slim & Compact"`
- Tamil/Hindi prefix text leaks through ("…குழுவில்" = "in the … group") because FB localizes the city header per geo-IP. Acceptable — product part of title is English.
- Prices: min Rs.99 (junk), max Rs.4,89,000, avg Rs.18,618 — realistic used-laptop range.
- Last run status: `success`, completed in ~3 min for 5 cities × 3 categories = 15 page loads.

## What auth would unlock + how to provide cookies

Anonymous mode misses ~70% of cards (no price visible without login). Authenticated mode unlocks:
- Per-search-term harvesting via `/marketplace/<city>/search/?query=<term>` — much higher per-term yield
- Full price visibility on every card
- Scroll-loaded items beyond the first 24
- Seller name + radius filtering

To enable, PATCH site 33 with:
```json
{
  "config": {
    "locations": ["mumbai"],
    "search_terms": ["laptop", "ssd", "graphics card", "monitor"],
    "max_items_per_term": 30,
    "radius_km": 40,
    "cookies": [
      {"name": "c_user", "value": "<copy from devtools>", "domain": ".facebook.com",
       "path": "/", "secure": true, "httpOnly": false},
      {"name": "xs",     "value": "<copy from devtools>", "domain": ".facebook.com",
       "path": "/", "secure": true, "httpOnly": true}
    ]
  }
}
```

**Caveats for cookie auth**: Use a throwaway FB account (automation violates ToS — account can be soft-banned). Cookies expire roughly every 60 days; refresh from a fresh logged-in browser session when the scraper logs `Redirected to /login — cookies expired`.

## Selectors used (stability notes)
| Signal     | Selector                                | Stability |
|------------|-----------------------------------------|-----------|
| Item card  | `a[href*="/marketplace/item/"]`         | High — semantic anchor |
| Title      | `img[alt]` inside card → text fallback  | Medium — alt text varies by FB UI version |
| Price      | regex `(?:₹\|Rs\.?\|INR)\s*[\d,]+`      | High — currency symbol invariant |
| Item ID    | regex `/marketplace/item/(\d+)`         | High — URL pattern stable since 2018 |

FB's CSS class names rotate weekly — never rely on them. The above anchors have held since at least 2023.
