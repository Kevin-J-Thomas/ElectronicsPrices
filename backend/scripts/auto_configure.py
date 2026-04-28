"""Auto-configure unconfigured sites by detecting their platform.

Probes each enabled site:
  1. Try Shopify (/products.json)
  2. Try WooCommerce Store API (/wp-json/wc/store/v1/products)
  3. Otherwise leave alone (manual config required)

For matched sites, sets scraper_type and a sane default config.
Idempotent — sites with non-empty config are left untouched (unless --force).
"""
from __future__ import annotations

import argparse
import sys

import requests

from app.db.session import SessionLocal
from app.models.site import Site

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/121.0 Safari/537.36"
)
HEADERS = {"User-Agent": UA, "Accept": "application/json"}


def probe_shopify(base_url: str) -> bool:
    url = base_url.rstrip("/") + "/products.json?limit=1"
    try:
        r = requests.get(url, headers=HEADERS, timeout=12)
    except requests.RequestException:
        return False
    if r.status_code != 200 or "json" not in (r.headers.get("content-type") or "").lower():
        return False
    try:
        return isinstance(r.json().get("products"), list)
    except ValueError:
        return False


def probe_woocommerce(base_url: str) -> bool:
    url = base_url.rstrip("/") + "/wp-json/wc/store/v1/products?per_page=1"
    try:
        r = requests.get(url, headers=HEADERS, timeout=12)
    except requests.RequestException:
        return False
    if r.status_code != 200 or "json" not in (r.headers.get("content-type") or "").lower():
        return False
    try:
        body = r.json()
        return isinstance(body, list)
    except ValueError:
        return False


def shopify_handles(base_url: str) -> dict[str, str]:
    """Discover up to 12 collection handles via /collections.json."""
    url = base_url.rstrip("/") + "/collections.json?limit=250"
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        cols = r.json().get("collections") or []
    except (requests.RequestException, ValueError):
        cols = []

    # Keep collections that look catalog-relevant
    keepers: dict[str, str] = {}
    keywords = (
        "processor", "cpu", "ram", "memory", "graphic", "gpu", "ssd", "storage",
        "hdd", "motherboard", "psu", "power-supply", "monitor", "keyboard",
        "mouse", "headset", "cabinet", "case", "cooler", "laptop",
    )
    for c in cols:
        handle = c.get("handle")
        title = (c.get("title") or "").lower()
        if not handle:
            continue
        if any(k in handle.lower() or k in title for k in keywords):
            # Use handle as both key + value (matches our scraper format)
            keepers[handle] = handle
        if len(keepers) >= 12:
            break
    return keepers


def configure(force: bool = False) -> None:
    db = SessionLocal()
    summary = {"shopify": 0, "woocommerce": 0, "skipped": 0, "unchanged": 0}
    try:
        sites = db.query(Site).filter(Site.enabled.is_(True)).all()
        for site in sites:
            already_configured = bool(site.config) and (
                "category_handles" in (site.config or {})
                or "category_slugs" in (site.config or {})
                or "category_urls" in (site.config or {})
                or "selectors" in (site.config or {})
            )
            if already_configured and not force:
                summary["unchanged"] += 1
                print(f"  {site.name}: already configured ({site.scraper_type}) — skip")
                continue

            print(f"Probing {site.name} ({site.base_url}) ...", end=" ", flush=True)

            if probe_shopify(site.base_url):
                handles = shopify_handles(site.base_url) or {"all": ""}
                site.scraper_type = "shopify"
                # Empty handle string means "use the collection name as-is"
                # but when no electronics-keyword collections exist, fall back to all-products.
                if handles == {"all": ""}:
                    # /collections/all is the universal Shopify "everything" handle
                    handles = {"all": "all"}
                site.config = {
                    "category_handles": handles,
                    "per_page": 50,
                    "max_pages": 5,
                    "request_timeout": 25,
                }
                site.categories = list(handles.keys())
                summary["shopify"] += 1
                print(f"SHOPIFY ✓ ({len(handles)} handles)")
                continue

            if probe_woocommerce(site.base_url):
                site.scraper_type = "woocommerce"
                site.config = {
                    "per_page": 50,
                    "max_pages": 10,
                    "request_timeout": 25,
                }
                site.categories = []  # let scraper paginate the whole catalog
                summary["woocommerce"] += 1
                print("WOOCOMMERCE ✓")
                continue

            summary["skipped"] += 1
            print("no API detected — skip")

        db.commit()
        print()
        print(f"Summary: {summary}")
    finally:
        db.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--force",
        action="store_true",
        help="re-configure even sites that already have a config",
    )
    args = ap.parse_args()
    configure(force=args.force)
