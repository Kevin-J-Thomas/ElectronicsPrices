# CF-Blocked Sites — Aggregator Investigation

Goal: bypass Cloudflare on GameNation (#4), MDComputers (#5), VoltedPC (#22) by routing through a price-comparison aggregator (Smartprix/PriceBaba/MySmartPrice/CompareRaja) — the same pattern used successfully for Acer (#29) and Lenovo.

The Acer/Lenovo pattern worked because Smartprix indexes products **by brand** at canonical paths like `/laptops/<brand>-brand` and `/computers/<brand>-brand`. That is not how Smartprix (or any other Indian aggregator) organizes Indian regional retailers — they aren't indexed as traversable seller catalogs at all. Aggregators link to Amazon/Flipkart on SKU pages, never to these three.

## Probes performed

Direct curl (Mozilla UA) to candidate aggregator paths returned 403 from Cloudflare for every probe — Smartprix, PriceBaba, and MySmartPrice all front their store pages behind CF. WebSearch / `site:` queries did not surface a single seller/store page for any of the three on any aggregator.

| Probe | Outcome |
|---|---|
| `smartprix.com/store/{mdcomputers,gamenation,voltedpc}` | 403 (no such canonical path) |
| `pricebaba.com/store/...`, `pricebaba.com/seller/...` | 403, no indexed store page |
| `mysmartprice.com/seller/mdcomputers` | 403, no listing |
| `site:smartprix.com mdcomputers` (Google) | zero relevant results |
| `site:pricebaba.com mdcomputers seller` | zero relevant results |
| `gamenation` SKU lookup on Smartprix | PS5 SKU pages link to Flipkart, never GameNation |

## Per-site outcomes

### GameNation (id=4) — no-aggregator
GameNation is a niche console reseller (new + pre-owned PS5/PS4/Xbox/Switch). Smartprix's gaming-console SKU pages exist but route buyers to Flipkart/Amazon/Sony, not to GameNation. There is no GameNation seller page on any aggregator. Listings added: **0**. DB updated: `enabled=false`, `last_status='no-aggregator'`.

### MDComputers (id=5) — no-aggregator
MDComputers is a Kolkata-based hardware retailer. Aggregators index *brands* (`/computers/asus-brand`) and *categories* (`/laptops`), not regional retailers. MDComputers is mentioned in user discussion threads as a complementary site to MySmartPrice/PriceDekho — i.e. users consult both — but it is not indexed as a seller on any of them. Listings added: **0**. DB updated: `enabled=false`, `last_status='no-aggregator'`.

### VoltedPC (id=22) — no-aggregator
VoltedPC sells custom-build gaming/workstation PCs. Custom-build configurators don't have stable SKUs, so they're structurally incompatible with how aggregators index products (per-SKU pages with price history). No aggregator listings exist or could exist for VoltedPC's catalog. Listings added: **0**. DB updated: `enabled=false`, `last_status='no-aggregator'`.

## Why the Acer pattern doesn't generalize

Acer/Lenovo work on Smartprix because they are **manufacturers** with thousands of indexed SKUs (e.g. `https://www.smartprix.com/laptops/acer-brand`). Smartprix's aggregator value proposition is brand-level price comparison across Amazon/Flipkart/Croma/Reliance Digital. Indian aggregators do not surface dedicated seller pages for tier-2 retailers like MDComputers or niche specialists like GameNation/VoltedPC; the closest they come is showing those retailers' prices buried inside a SKU page, but there is no traversable URL to enumerate "all SKUs sold by MDComputers" on any aggregator.

## Recommendation

These three are appropriate to leave disabled with `last_status='no-aggregator'`. Future paths to revisit only if business priority justifies the cost:

1. Run them through a residential-proxy + stealth Playwright pipeline (same effort as Acer's failed direct-attempt before falling back to Smartprix).
2. Negotiate an affiliate/data feed directly with the retailer.
3. Drop them from the inventory project entirely.

## DB changes

```sql
UPDATE sites SET enabled=false, last_status='no-aggregator' WHERE id IN (4,5,22);
```

No code, scraper class, or schema changes were made. No new dependencies added.
