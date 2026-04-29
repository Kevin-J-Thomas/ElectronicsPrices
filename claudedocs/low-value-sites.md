# Low-Value Sites — Final Triage

Date: 2026-04-27. Time-boxed at 20 minutes; finished in ~12 minutes.

All three sites turned out to be **build-to-order PC configurators**, not retailers with
browsable SKU catalogs. They were marked `enabled=false, last_status='no-data'` in the
`sites` table and abandoned.

## Site 11 — ProXPC (https://www.proxpc.com)

- **Probed:** Shopify `/products.json`, WooCommerce `/wp-json/wc/store/v1/products`,
  homepage HTML inspection.
- **Findings:** Site is a Next.js SPA (`_next/static` markers in HTML); both API
  endpoints return 404 served by the Next 404 page. No public catalog API. Previously
  flagged `blocked-spa`.
- **Outcome:** abandoned (`no-data`). 0 listings.

## Site 19 — TheMVP (https://themvp.in)

- **Probed:** HTTPS times out (cert/SNI issue); HTTP works. Homepage parsed for product
  / category links.
- **Findings:** OpenCart-based site (`catalog/view/...` assets, PHPSESSID cookies) but
  surfaces only **use-case landing pages** (`/gaming-pc`, `/cad-workstations/solidworks`,
  `/3d-design-animation-pc/houdini`, etc.). No `index.php?route=product/...` URLs, no
  product cards with prices — it's a custom-build configurator, not a SKU catalog.
  Previously flagged `tiny-catalog`, which matches what's actually exposed.
- **Outcome:** abandoned (`no-data`). 0 listings.

## Site 21 — SMCInternational (https://smcinternational.in)

- **Probed:** Shopify `/products.json` (404), WooCommerce store API (404), homepage HTML.
- **Findings:** Custom CodeIgniter app (`<title>404 Page Not Found</title>` template +
  `/extra/css/...` paths). Front-page is a gaming-PC configurator funnel ("Custom Build
  and Pre-built Gaming PC"), not a browsable product list. No standard catalog endpoint.
  Previously flagged `blocked-spa`.
- **Outcome:** abandoned (`no-data`). 0 listings.

## Total

**0 listings added.** All three sites disabled with `last_status='no-data'`. No code
changes; DB-only updates via `UPDATE sites SET enabled=false, last_status='no-data'
WHERE id IN (11, 19, 21);`.
