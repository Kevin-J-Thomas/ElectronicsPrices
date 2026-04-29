# Ant-PC scraping investigation

**Date:** 2026-04-28
**Site:** https://www.ant-pc.com/ (site_id=9)
**Outcome:** Scraping working — 38 listings on first run, 0 errors.

## Key finding: it isn't an SPA

The original ticket assumed Ant-PC is a React SPA whose data lives behind an
internal API. That assumption was wrong. The Playwright network capture
showed the front-end is **server-rendered PHP** — every page returns
fully-populated `text/html`. The only `application/json` request from
the site itself is `/admin-secure/getCsrfToken`, which belongs to the
admin login panel and contains no product data.

The earlier `last_status='spa-defer'` was likely caused by the
homepage's chatty third-party analytics (Zoho, FB Pixel, Google Ads) keeping
Playwright's `networkidle` waiter from ever resolving — a false negative,
not a real SPA.

## Site structure

Top-level taxonomy (from homepage links):

```
/gaming/gaming-desktop/{budget|performance|professional|flagship}-...
/workstation/{content-creations|engineering|trading|ai-deep-learning-workstations}/...
/servers/{gpu-servers|storage-server}/...
```

Each leaf category page renders a server-side product grid with this markup:

```html
<div class="col-lg-3 ... pListN-box">
  <h2 class="box-heading"><span>ANT PC DORYLUS CL940N</span></h2>
  ...specs <ul>...
  <p class="startingPrice-numb">₹ 75,669 </p>
  <a href=".../ant-pc-dorylus-cl940n" class="btn-comm">Configure Now</a>
</div>
```

CSS selectors that work:

| Field | Selector |
|---|---|
| product card | `.pListN-box` |
| title | `h2.box-heading span` |
| product URL | `a.btn-comm` |
| starting price | `p.startingPrice-numb` |

These map directly onto the existing `StaticHtmlScraper` config schema —
no new scraper class needed.

## What was changed

1. **DB only.** Updated `sites` row id=9:
   - `scraper_type`: `static`
   - `enabled`: `true`
   - `last_status`: `NULL` (was `spa-defer`)
   - `config`: 13 category URLs + the four selectors above + `max_pages: 1`
2. No code changes. No new scraper file. No registry edit.
3. `ruff check app/scrapers/` — passes.

## Categories enabled

13 categories with priced listings (gaming desktops + workstations across
content creation, engineering, trading, and AI-DL).

```
gaming/gaming-desktop/{budget,performance,professional,flagship}
workstation/content-creations/{3d-animation,audio,photo-video}-...
workstation/engineering/{3d-rendering,architecture-cad}-...
workstation/ai-deep-learning-workstations/{gpu,multi-gpu}-workstation
workstation/trading/{multi-monitor,single-display}-...
```

## What was NOT scraped (deliberately)

The `/servers/*` family (`gpu-servers`, `storage-server`) and
`/workstation/ai-deep-learning-workstations/nvidia-dgx` use a different
template — product cards have no `startingPrice-numb`, only an
"Enquire Now / Quote" CTA. There are no listed prices to capture.
Adding them would produce zero rows, so they're omitted from `category_urls`.

If pricing for those is ever published, just add the URL paths — the same
selectors will work as long as the markup is unchanged.

## Verification

```sql
SELECT site, COUNT(*) FROM listings WHERE site='Ant-PC' GROUP BY site;
-- Ant-PC | 38

SELECT id, status, items_scraped, items_new
FROM scrape_runs WHERE site_id=9 ORDER BY id DESC LIMIT 1;
-- 213 | success | 38 | 38
```

Sample top-priced rows: ANT PC PHEIDOLE XE955 (₹16.6 lakh),
ANT PC PHEIDOLE TH955WX (₹15 lakh), ANT PC DACETON X900X (₹10 lakh).

## Next steps for the user

Nothing required. Ant-PC will be picked up on the next scheduled run.
Optional improvements:

- **Pagination.** Currently `max_pages: 1`. The category pages do show a
  paginator (`?page=N`), but the largest category right now has only 4 items.
  If the catalog grows, bump `max_pages` to 3-5.
- **Product detail pages.** If the user later wants component-level breakdowns
  (CPU, GPU, RAM SKUs), those live on individual product pages and would need
  a follow-up fetch per listing — out of scope for this round.
- **Servers re-check.** Periodically re-check `/servers/*` to see if Ant-PC
  starts publishing list prices; if so, add those paths to `category_urls`.
