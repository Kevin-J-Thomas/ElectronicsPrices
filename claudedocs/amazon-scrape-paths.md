# Amazon India scraping — path evaluation (2026-04-27)

## TL;DR

**Path A wins. Free. Already implemented.** A plain `httpx.get()` against `https://www.amazon.in/s?k=...&i=computers&page=N` with a normal desktop User-Agent returns the full server-rendered search HTML — no JS, no CAPTCHA, no IP throttling on a small sequential crawl. We do **not** need PA-API, paid scraping APIs, or residential proxies.

A live end-to-end run via the worker pulled **935 items in 144s across 15 queries × 3 pages, 0 errors**.

## Paths investigated

### Path A — Server-rendered HTML (FREE) ✅ IMPLEMENTED

**Discovery method**: Probed `https://www.amazon.in/s?k=ssd+1tb&i=computers` with both desktop and iPhone User-Agents via `curl`.

**Result**:
- HTTP 200, ~1.5 MB HTML response
- 27 product cards per page parseable via `div.s-result-item[data-asin][data-component-type="s-search-result"]`
- ASIN, title, price (`.a-price .a-offscreen`), and link all present
- 3 sequential page fetches with 2 s delay → all succeeded, no rate-limit
- No `captcha`, `validateCaptcha`, `automated access`, or "Sorry, we just need" markers in any response
- Pagination via `&page=N` query param works up to ~7 pages (Amazon's relevance cap, not a block)

**Why it works (best guess)**: Amazon serves SEO-friendly HTML for organic search traffic; their bot detection appears to gate JS-only / login / cart / Add-to-cart endpoints, not anonymous search results. They reserve aggressive blocking for high-volume/abusive patterns — at our scale (15 queries × 3 pages, weekly) we're indistinguishable from organic browsing.

**Risk**: Amazon could flip on bot protection on this path at any time. The scraper detects the standard signals (HTTP 503/429, CAPTCHA strings) and aborts cleanly so we'd see the failure in `last_status` immediately. If that happens, fall back to Path C2 (ScraperAPI ~$49/mo).

### Path B — Amazon Product Advertising API (PA-API 5.0)

**Verdict**: Effectively closed for this use case.

- Requires an active **Amazon Associates** affiliate account in good standing.
- New Associates accounts get **provisional access only** — PA-API access is revoked if you don't generate **3 qualifying referral sales within 180 days**. We are an inventory-tracking app, not an affiliate marketing site, so we won't generate sales.
- Even with access: rate limit is **1 req/sec, 8,640 req/day** baseline (scales with referral revenue), and the API returns ~10 items per `SearchItems` call — fine for our scale, but moot because of the access barrier.
- Returns prices, ASINs, titles, images — exactly what we'd want.
- Python: `python-amazon-paapi` library exists.

Documenting only — not viable until/unless this app generates affiliate sales.

### Path C — Paid scraping APIs (only if Path A breaks)

| Provider | Plan that fits ~10K Amazon pages/mo | Monthly cost (USD) | Notes |
|---|---|---|---|
| **ScraperAPI** | "Hobby" 100K credits ≈ 10K Amazon pages (10 credits/req for premium) | **$49** | Has a dedicated Amazon endpoint with structured JSON; no proxy mgmt; 99%+ success quoted for Amazon. Cheapest of the three. |
| **ZenRows** | "Developer" 250K credits | **$69** | JS rendering + premium proxies cost extra credits; Amazon-specific success ~95%. |
| **Bright Data** | Pay-as-you-go SERP/Web Unlocker | **$3 per 1K req → ~$30** for 10K, plus $499/mo enterprise commitment for many features | Best success rate, worst onboarding. Overkill. |
| **ScrapingBee** | "Freelance" 150K API credits | **$49** | Similar to ScraperAPI; Amazon costs 25 credits/req → ~6K Amazon pages on this plan. Tighter than ScraperAPI. |

**Integration effort**: ~1 hour. All four providers expose an HTTP API where you replace `https://www.amazon.in/...` with `https://api.scraperapi.com/?api_key=K&url=https://www.amazon.in/...`. The existing parsing logic in `amazon.py` is unchanged.

**Recommendation if Path A fails**: ScraperAPI at $49/mo. Add `proxy_provider`, `proxy_api_key` fields to `Site.config`, wrap the `client.get(url)` call with a routing helper.

### Path D — Self-hosted residential proxies / Tor

**Verdict**: Not worth it.

- Tor exit nodes are pre-blocked by Amazon — every Tor IP fails the bot challenge. Tested: not viable.
- "Free" residential proxy lists are scraped from compromised devices, ethically and legally questionable, and have <30% success rate against Amazon.
- Building our own residential pool requires renting IPs from real ISPs at ~$10/GB — works out more expensive than ScraperAPI.

## Recommendation table

| Path | Cost | Effort | Risk | Recommendation |
|---|---|---|---|---|
| **A. Plain HTTP scraping** | **$0** | **DONE** | Medium — Amazon could block | **Use this. Already deployed.** |
| B. PA-API | $0 (if you have Associates) | 4–8 h | Access revoked without sales | Skip — closed to us |
| C1. ScraperAPI | $49/mo | 1 h | Low | **Fallback if A breaks** |
| C2. ZenRows | $69/mo | 1 h | Low | Slightly worse $ than C1 |
| C3. Bright Data | $30+ usage / $499 commit | 2 h | Low | Overkill |
| C4. ScrapingBee | $49/mo (~6K Amazon req) | 1 h | Low | Tighter req cap than C1 |
| D. Self-hosted proxies | $10+/GB | 8+ h | High (legality, success rate) | Avoid |

## What was implemented

**New file**: `backend/app/scrapers/amazon.py` — `AmazonScraper(BaseScraper)`.
- Iterates `(search_query × page)`, parses standard search-card HTML.
- Canonicalises product URLs to `https://www.amazon.in/dp/<ASIN>` (stable across crawls; sponsored placeholders' `#` links are discarded).
- Detects rate-limit (HTTP 503/429) and CAPTCHA markers; aborts the run cleanly so failure is visible in `Site.last_status`.
- Configurable politeness delay (default 2 s) between requests.

**Edited**: `backend/app/scrapers/registry.py` — `scraper_type="api"` now dispatches Amazon by site name (mirrors how `location` dispatches OLX/Facebook). Other `api` sites still raise `ScraperNotImplemented` until they get their own implementations.

**DB row** (`Site` id=31, Amazon):
- `scraper_type`: `dynamic` → `api`
- `enabled`: `false` → `true`
- `config`: 15 PC-parts search queries, `max_pages=3`, `delay_seconds=2.0`, `request_timeout=25`

**Lint**: `ruff check app/scrapers/` → all checks passed.

**Live run**: 935 items scraped, 935 new, 0 errors, 144 s. Triggered via `curl -X POST http://api.inventory.local/admin/sites/31/run -H "X-Admin-Key: ..."`.

## Operational notes

- **Tune via `Site.config`**: edit `search_queries` to add new product types; bump `max_pages` to 5 for deeper coverage (Amazon stops returning relevant results past ~7).
- **Back off if blocked**: if `last_status='failed'` with a CAPTCHA error, raise `delay_seconds` to 5 and reduce `max_pages` to 2 before considering Path C.
- **Item URLs are canonical**: `/dp/<ASIN>` — safe to use as the dedup key in `listings.url`. Re-crawls update `last_seen_at` and append a fresh `price_history` row.
- **Do NOT add a User-Agent override** in the `Site` row unless you have a tested one; the default desktop-Chrome UA in the scraper is what passed the live test.
