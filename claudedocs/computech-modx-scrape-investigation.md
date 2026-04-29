# Computech + ModxComputers — SPA API discovery & scrapers

**Status: both shipping. Computech=120 listings, ModxComputers=960 listings.**

## Context

Both sites are Next.js SPAs sitting in front of WordPress-like / Express + Mongo
backends. Old static-HTML attempts failed (`last_status='spa-defer'`). Goal:
find the JSON API the SPAs actually call and scrape from there, instead of
trying to render the page.

## API discovery

Approach: load each homepage in headless Chromium, listen on `response`,
filter for `application/json` 200s with body ≥ 200 B at URLs containing
`/api/`, `/wp-json/`, or `/graphql`.

### ModxComputers — clean win

Two API hosts surfaced; the canonical one is `api.modxcomputers.com`:

| URL | Size | Notes |
|-----|------|-------|
| `https://api.modxcomputers.com/api/products?page=N&limit=200` | 19–75 KB | **Used by scraper.** Paginated, returns `{success, data, total, count}`; `total=1974` is inflated (drafts/soft-deleted) — only ~960 are unique-public. |
| `/api/categoryProducts` | 108 KB | Section blocks, only 20 products surfaced |
| `/api/best-seller-product` | 102 KB | 10 products |
| `/api/subcategories` | 117 KB | 29 subcategory slugs |
| `/api/product-category/<slug>` | 1–5 KB | Pre-built PCs and a few hand-picked slugs only; most subcategory slugs 404 here |

Plain `requests` works (no Cloudflare, no auth) with `Origin/Referer` set to the
storefront. Sample product:

```json
{
  "_id": "68cbdf95...",
  "name": "Gigabyte RTX 5060 Windforce Max OC 8GB GDDR7 Graphics Card",
  "slug": "gigabyte-geforce-rtx-5060-windforce-max-oc-8g-gddr7",
  "price": 60000, "priceSale": 37490,
  "image": {"url": "https://img.modxcomputers.com/..."}
}
```

Storefront URL is `https://modxcomputers.com/product/<slug>` (verified 200).

### Computech — partial win

The SPA does call `https://computechstore.in/api/products/public?page=...` and
returns it during initial render. But that endpoint is firewalled — every
direct request (plain `requests`, Playwright `page.request.get`, even
in-browser `fetch()` from the same origin) returns **403 with empty body**.
Cookies set on the homepage include a JWT `auth_token`, `csrf-token`, and a
`__Host-next-auth.csrf-token` plus several obfuscated `localStorage` keys — the
gating is probably done at the API layer with a server-side-only token minted
during Next.js SSR. Reproducing the auth flow is well past the time-cap.

Useful side-effect: the SSR'd homepage HTML contains **120 product cards** in
plain markup (anchors `^/product/<slug>$` inside `<div class="product-item">`
containers carrying title + sale price + MRP). That's the path we took. Other
URLs (`/category/<slug>`, `/shop`, `/products`) either 404 or return a CSR
shell with zero product hrefs, so only `/` is a useful seed.

## Code changes

* `backend/app/scrapers/modx.py` (new) — `ModxScraper`. Paginates
  `api.modxcomputers.com/api/products?page=N&limit=200`, stops on `total` reach
  or empty page, prefers `priceSale` then `price`, builds storefront URL from
  `slug`.
* `backend/app/scrapers/computech.py` (new) — `ComputechScraper`. Fetches
  `/` (and any optional `extra_pages` from `Site.config`), parses anchors
  matching `^/product/[a-z0-9-]+$` whose closest `div.product-item` ancestor
  contains a `₹` price. Title precedence: image alt → `aria-label`/`title` →
  cleaned card text.
* `backend/app/scrapers/registry.py` — added Modx and Computech under the
  `api` branch, name-dispatched (mirrors how OLX is dispatched in `location`).
* DB rows PATCHed: site 2 (`ModxComputers`) and site 15 (`Computech`) →
  `scraper_type=api`, `enabled=true`. Modx config: `per_page=200, max_pages=12`.
  Computech config: just `request_timeout=25`.

`uv run ruff check app/` clean. Worker restarted to pick up the new
`registry.py`.

## Run results

```
Modx scrape: total=1974 (advertised); 9 pages × 200 produced 960 unique items
Computech scrape: 120 unique items from homepage in 1 request
```

Direct DB confirmation:

```
 site          | count
---------------+-------
 Computech     |   120
 ModxComputers |   960
```

Both `last_status='success'`. (`Site.listings_count` shows 0 in the admin
endpoint — that field is a denormalised cache that isn't refreshed on scrape;
not a regression introduced by this change.)

## What's left / known limits

* **Computech ceiling = ~120.** Matches what's on the homepage. Reaching the
  full catalog requires either bypassing the API auth (mint or replay the
  Next.js `auth_token` JWT — non-trivial; the bundle obfuscates the key
  storage in `localStorage` under random-looking names) or rendering each
  category page in a headless browser and scrolling. Both are big lifts; not
  worth doing inside the time-cap given this is a small regional retailer.
* **Modx ceiling = ~960.** API claims 1974 but pages 10–12 returned only
  duplicates of pages 1–9, suggesting hidden/draft products inflate the
  counter server-side. Consistent across runs.
* Neither scraper extracts seller/brand/category — only what we need to fill
  `listings.title|url|price|currency|condition`. Fine for now.
