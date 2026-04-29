# Acer India Scrape Investigation

**Date**: 2026-04-28
**Site**: site_id=29, currently `enabled=false, last_status='cf-blocked'`
**Outcome**: **Partial / unstable.** Stealth Playwright bypassed protection once but got IP-flagged on the second batch of requests. No reliable free path identified within the 30-minute time-cap.

## Key Findings

### 1. Protection vendor: Akamai (not Cloudflare)
- DNS: `www.acer.com` → `dsa.acer.com.edgekey.net` → `e64300.b.akamaiedge.net`
- DNS: `store.acer.com` → `ion.acer.com.edgekey.net` → `e64300.a.akamaiedge.net`
- This is **Akamai Bot Manager Premier** (uses `_abck`, `bm_sz` cookies). Significantly harder to bypass than Cloudflare. The `last_status='cf-blocked'` label in the DB is misleading.

### 2. Site has two distinct properties
| URL | Purpose | Has prices? |
|---|---|---|
| `www.acer.com/in-en` | Marketing / product specs | **NO** |
| `store.acer.com/en-in` | Actual ecommerce | YES (per WebSearch confirmation) |

The previous Playwright attempts targeted the wrong subdomain. The store path is `/en-in`, not `/in/en` (which 404s).

### 3. TLS / curl baseline
| Method | Result |
|---|---|
| `curl https://www.acer.com/in-en` | TLS handshake OK, HTTP/2 stream opens, then `INTERNAL_ERROR (err 2)` — JA3/JA4 fingerprint rejected |
| `curl https://store.acer.com/en-in` | Same: HTTP 000, no bytes returned |
| `curl https://acer.com/` | 301 from AWS ELB → `https://www.acer.com/` (root only, no `/in-en` redirect) |
| Anthropic `WebFetch` | Timeout (60s exceeded) — Akamai blocks Anthropic's fetcher too |

### 4. Stealth Playwright result (the one breakthrough)
With `playwright-stealth==2.0.3` installed in the `worker` container and a fresh browser per probe, the **first batch** of 5 sequential requests to `www.acer.com/in-en` succeeded:

```
PROBING: https://www.acer.com/in-en           → HTTP 200, 597 KB, title "Acer Laptops, Desktops, Chromebooks... | Acer India"
PROBING: https://www.acer.com/in-en/laptops   → HTTP 200, 696 KB, title "Laptop Computers & 2-in-1 Laptops | Acer India"
PROBING: https://www.acer.com/us-en           → HTTP 200, 638 KB
PROBING: https://www.acer.com/in-en/sitemap.xml → HTTP 200, 508 KB XML
PROBING: https://store.acer.com/in/en         → ERR_HTTP2_PROTOCOL_ERROR (wrong path; correct is /en-in)
```

The "captcha" / "akamai" string markers found in the HTML are CSS class references and JS asset URLs, **not** an active challenge — content was real.

### 5. The honeymoon ended on the second batch
A few seconds after the first probe, every subsequent Playwright navigation (even to URLs that worked moments earlier) returned `net::ERR_HTTP2_PROTOCOL_ERROR`. Akamai's risk-scoring engine flagged the worker container's egress IP. Cooldown not tested within the time-cap (would need ~5–15 min).

### 6. What I did not get to (out of time)
- Confirm `store.acer.com/en-in` (the real ecommerce path) works with stealth — only marketing site was confirmed
- Extract `__NEXT_DATA__` / JSON-LD product hydration from a successful page load
- Test cooldown duration of Akamai IP flag
- Try `playwright-stealth` with fingerprint-randomized contexts (different UA / viewport per request)

## Reproducible commands

```bash
# Install stealth in worker (already done)
docker compose exec -T worker uv pip install playwright-stealth

# Run the probe
docker compose cp /tmp/acer_stealth_probe.py worker:/tmp/acer_stealth_probe.py
docker compose exec -T worker uv run python /tmp/acer_stealth_probe.py
```

Probe scripts saved at `/tmp/acer_stealth_probe.py`, `/tmp/acer_extract.py`, `/tmp/acer_extract2.py` on the host.

## What was tried (matrix)

| Attempt | Outcome |
|---|---|
| Plain `curl` (Chrome UA) | HTTP 000, TLS-level reject |
| `curl --tlsv1.3` | HTTP 000 |
| `curl -v` (HTTP/2) | TLS OK, then `INTERNAL_ERROR (err 2)` from Akamai |
| Anthropic `WebFetch` | 60 s timeout |
| Playwright (no stealth) — prior attempt | `ERR_HTTP2_PROTOCOL_ERROR` |
| Playwright `--disable-http2` — prior attempt | 30 s hang |
| **Playwright + `playwright-stealth` v2.0.3, fresh browser per URL** | **First 5 requests: HTTP 200, full HTML.** Subsequent requests: blocked. |
| Same but reusing context across URLs | Blocked on first navigation |
| Different UA (Windows Chrome 130) after IP-flag | Still blocked |
| `store.acer.com/in/en` (wrong path) with stealth | `ERR_HTTP2_PROTOCOL_ERROR` |
| `store.acer.com/en-in` (correct path) with stealth | **Not tested** — IP-flagged before the right path was identified |

## Code changes made

**None.** Stopped before modifying `backend/app/scrapers/` because the result is not reproducibly green. Site row 29 left as `enabled=false, last_status='cf-blocked'`.

The `playwright-stealth` package was installed in the `backend` and `worker` containers via `uv pip install` — this persists in the running container only, not the image. To make it permanent, add `"playwright-stealth>=2.0.3"` to `backend/pyproject.toml` dependencies and rebuild.

## Recommended next steps (ranked)

### Option A — Stealth + careful pacing (free, ~4 hr more work, **uncertain**)
1. Add `playwright-stealth` to `backend/pyproject.toml` and rebuild.
2. Wait ~30 min, retest `store.acer.com/en-in` (the actual ecommerce subdomain) with stealth — never confirmed working.
3. If it works, build `backend/app/scrapers/acer.py` with:
   - One fresh `browser_context` per page (no context reuse)
   - `await asyncio.sleep(random.uniform(15, 40))` between pages
   - `max_pages=1` initially; 1 scrape every 6+ hours via Celery beat
   - Randomized UA from a pool of 5–10 real Chrome variants
   - On `ERR_HTTP2_PROTOCOL_ERROR`, mark `last_status='akamai-blocked'` and back off 24 h
4. **Risk**: even with all of this, Akamai's ML may flag the worker IP within days, requiring a residential-proxy rotation. This is a "works until it doesn't" path.

### Option B — Residential proxy + stealth (paid, ~$15–80/mo, **high reliability**)
- **Bright Data** residential proxies: ~$8.40 / GB, ~$80/mo for ~10 GB. Pair with stealth Playwright. Most reliable.
- **Oxylabs** residential: similar pricing, similar reliability.
- **Smartproxy / Decodo**: ~$3.50 / GB at low tier, decent.
- Integration effort: **2–4 hours.** Add `proxy={"server": "...", "username": "...", "password": "..."}` to Playwright `launch()`. The `Site.config` JSON can hold the proxy URL. Rotate per request via Bright Data's per-request endpoint.

### Option C — Anti-bot-as-a-service (paid, ~$30–250/mo, **highest reliability**)
- **ScrapingBee**: ~$49/mo for 150k API credits, JS rendering + stealth + proxy bundled. Send GET to their endpoint, get HTML back. Simplest integration (~30 min).
- **ScraperAPI**: ~$49/mo for 100k requests, similar.
- **ZenRows**: ~$69/mo, advertises Akamai bypass specifically.
- Integration: replace `page.goto(url)` with `requests.get(f"https://api.scrapingbee.com/?api_key=...&url={url}&render_js=true")`. ~30 min.

### Option D — Use price aggregators instead (free, **highest reliability**, less coverage)
Acer products on Flipkart, Amazon.in, Smartprix, Reliance Digital are all already-scrapable competitors. Add `Smartprix` as a new site with `dynamic` scraper pointed at `https://www.smartprix.com/laptops/acer-brand` (likely no Akamai). This gets you Acer prices without fighting Akamai.

### Option E — Abandon Acer
If Acer represents a small fraction of catalog, drop it. Aggregators (Option D) cover the same SKUs.

## My recommendation

**Option D + Option B as fallback.** Add Smartprix scraper for Acer SKUs first (free, ~2 hr); only invest in Bright Data ($80/mo) if direct-from-vendor is required. Option A (free stealth) is unreliable enough that engineering time spent on it likely exceeds the cost of a residential proxy plan.

User confirmation needed before signing up for any paid service.

---

## Update — 2026-04-28 (continuation)

**Outcome: working.** 53 Acer listings scraping successfully via the Smartprix aggregator (Option D from the recommendation list). Direct-from-Acer was retested and confirmed still IP-flagged.

### What was retested

1. **`store.acer.com/en-in`** (the correct ecommerce path, never tested before the flag) — still `ERR_HTTP2_PROTOCOL_ERROR` even with `playwright-stealth==2.0.3`, randomized UAs (Chrome 125 / 130 / Win 10), fresh browser per request, and 8–15 second pacing between probes. The Akamai IP flag persists across 30+ minutes.

2. **`www.acer.com/in-en`** — also still blocked.

Conclusion: Akamai's IP risk score doesn't decay quickly enough on this datacenter IP for direct scraping to be viable without residential proxies.

### What was implemented (working path)

**No code changes.** Reconfigured the existing Acer site row to use the dynamic Playwright scraper against Smartprix's Acer brand pages.

DB row 29 (`Acer`):
| Field | Value |
|---|---|
| `base_url` | `https://www.smartprix.com/` |
| `scraper_type` | `dynamic` |
| `enabled` | `true` |
| `last_status` | `success` (auto-updated by run) |
| `categories` | `["laptops", "desktops"]` |

`config`:
```json
{
  "category_urls": {
    "laptops":  "/laptops/acer-brand",
    "desktops": "/computers/acer-brand"
  },
  "selectors": {
    "product_item": ".sm-product",
    "title":        "a.name",
    "url":          "a.name",
    "price":        "span.price"
  },
  "pagination_pattern": "?page={page}",
  "max_pages": 1,
  "wait_selector": ".sm-product",
  "scroll_to_bottom": true,
  "settle_ms": 3500
}
```

### Verification (run #214)
- `items_scraped: 56`, `items_new: 53`, `items_updated: 3`, duration **13 s**, 0 errors
- Sample products: Acer Nitro V 15 ₹75,990 · Acer Nitro Lite NL16-71G ₹62,990 · Acer Aspire 7 ₹69,900 · Acer Aspire 3 14 ₹20,990 · Acer Nitro V 16 ₹104,446

### Plain-HTTP fallback was tested and rejected
`curl https://www.smartprix.com/laptops/acer-brand` → HTTP 403. Smartprix has bot protection at the static layer too, so the dynamic (Playwright) scraper is required even for the aggregator.

### What's still unresolved (out of scope for this task)
- **Direct-from-Acer**: still requires residential proxies (Bright Data ~$80/mo). Documented as Option B in the original recommendation; no progress made.
- **Coverage limitation**: Smartprix shows ~28 products per category page on first load (lazy-loaded beyond that). With `max_pages=1`, total catalog is the laptops + desktops first-page = 56 items. Increasing `max_pages` would need verifying Smartprix's pagination scheme (likely `?page=N` but unconfirmed).

### `playwright-stealth` package note
The package was installed via `uv pip install` in running containers but **is not in `backend/pyproject.toml`** — it disappears on image rebuild. Since the working path doesn't need stealth (Smartprix loads with vanilla Playwright), leaving this gap is acceptable. If Option B / direct-from-Acer is ever revisited, add `"playwright-stealth>=2.0.3"` to `backend/pyproject.toml` first.
