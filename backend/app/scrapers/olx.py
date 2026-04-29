"""OLX (India) scraper using the public mobile-app API.

OLX exposes its search API at:
    https://www.olx.in/api/relevance/v4/search

Cloudflare blocks the website front-end to non-browser clients, but the API
itself accepts requests with a mobile-app User-Agent. We use it directly,
bypassing all the headless-browser pain.

Site.config schema:
    {
        "locations": {              # OLX numeric location IDs by city name
            "Mumbai":   4058997,
            "Delhi":    4058659,
            "Bangalore":4058803,
        },
        "categories": [             # OLX category IDs to scrape per location
            1505,    # Computers & Laptops
            1515,    # Computer Accessories
            1509,    # Hard Disks, Printers & Monitors
        ],
        "search_queries": [         # within each category, narrow with these queries
            "laptop", "ssd", "ram", "graphics card", "processor", "monitor"
        ],
        "size": 50,                 # results per API page (max 50)
        "max_pages": 4,             # how deep per (location × category × query)
        "request_timeout": 20
    }

Defaults are sensible for an India-wide PC-parts crawl; override anything.
"""
from __future__ import annotations

import logging
from typing import Any

import requests

from app.scrapers.base import BaseScraper, ScrapedItem, ScrapeResult

log = logging.getLogger(__name__)

DEFAULT_UA = "OLX/14.0 (iPhone; iOS 17.0; Scale/3.00)"

DEFAULT_LOCATIONS: dict[str, int] = {
    "Mumbai":    4058997,
    "Delhi":     4058659,
    "Bangalore": 4058803,
    "Hyderabad": 4058804,
    "Chennai":   4058674,
    "Pune":      4059162,
}

DEFAULT_CATEGORY_IDS: list[int] = [
    1505,  # Computers & Laptops
    1515,  # Computer Accessories
    1509,  # Hard Disks, Printers & Monitors
]


class OLXScraper(BaseScraper):
    """API-based scraper for OLX India.

    Iterates (location × category × query × page) and pulls listings via
    the public search API. Each listing is saved as condition='used'
    with city + seller info preserved.
    """

    API_BASE = "https://www.olx.in/api/relevance/v4/search"
    ITEM_URL = "https://www.olx.in/item/iid-{id}"

    def scrape(self) -> ScrapeResult:
        result = ScrapeResult()
        config = self.site.config or {}

        locations: dict[str, int] = config.get("locations") or DEFAULT_LOCATIONS
        category_ids: list[int] = config.get("categories") or DEFAULT_CATEGORY_IDS
        queries: list[str] = config.get("search_queries") or [""]
        size = min(int(config.get("size", 50)), 50)
        max_pages = int(config.get("max_pages", 4))
        timeout = int(config.get("request_timeout", 20))

        ua = self.site.user_agent or DEFAULT_UA
        headers = {"User-Agent": ua, "Accept": "application/json"}

        seen_ids: set[str] = set()

        for city, loc_id in locations.items():
            for cat_id in category_ids:
                for q in queries:
                    log.info(
                        "OLX: city=%s loc=%s category=%s query=%r",
                        city, loc_id, cat_id, q,
                    )
                    for page in range(max_pages):
                        params: dict[str, Any] = {
                            "location": loc_id,
                            "category": cat_id,
                            "page": page,
                            "size": size,
                        }
                        if q:
                            params["query"] = q

                        try:
                            resp = requests.get(
                                self.API_BASE, headers=headers,
                                params=params, timeout=timeout,
                            )
                        except requests.RequestException as exc:
                            result.errors.append(
                                f"OLX {city}/cat={cat_id}/q={q!r}/p={page}: {exc}"
                            )
                            break

                        if resp.status_code != 200:
                            result.errors.append(
                                f"OLX {city}/cat={cat_id}/q={q!r}/p={page}: HTTP {resp.status_code}"
                            )
                            break

                        try:
                            payload = resp.json()
                        except ValueError:
                            result.errors.append(
                                f"OLX {city}/cat={cat_id}/q={q!r}/p={page}: invalid JSON"
                            )
                            break

                        ads = payload.get("data") or []
                        if not ads:
                            break

                        added_this_page = 0
                        for ad in ads:
                            ad_id = str(ad.get("id") or ad.get("ad_id") or "")
                            if not ad_id or ad_id in seen_ids:
                                continue
                            item = self._parse_ad(ad, city)
                            if item is None:
                                continue
                            seen_ids.add(ad_id)
                            result.items.append(item)
                            added_this_page += 1

                        # Stop early if we got fewer than 'size' items (last page)
                        if len(ads) < size:
                            break

                    log.debug("OLX: city=%s cat=%s q=%r — running total: %d items",
                              city, cat_id, q, len(result.items))

        log.info("OLX: %d unique items, %d errors",
                 len(result.items), len(result.errors))
        return result

    # ------------------------------------------------------------------

    def _parse_ad(self, ad: dict, fallback_city: str) -> ScrapedItem | None:
        title = (ad.get("title") or "").strip()
        ad_id = str(ad.get("id") or ad.get("ad_id") or "")
        if not title or not ad_id:
            return None

        price_raw = self._extract_price(ad.get("price"))
        if price_raw is None or price_raw <= 0:
            return None

        url = self.ITEM_URL.format(id=ad_id)

        # User / seller name
        seller = None
        u = ad.get("user")
        if isinstance(u, dict):
            seller = (u.get("name") or "").strip() or None
        if not seller:
            seller = (ad.get("user_name") or "").strip() or None

        # Location → city name from resolved hierarchy if available
        loc_resolved = ad.get("locations_resolved") or {}
        city = loc_resolved.get("ADMIN_LEVEL_3_name") or fallback_city

        # Lat/lon if present (some ads carry it; many don't)
        lat = lon = None
        for loc in ad.get("locations") or []:
            if isinstance(loc, dict):
                lat = loc.get("lat") or loc.get("latitude")
                lon = loc.get("lon") or loc.get("longitude")
                if lat is not None and lon is not None:
                    try:
                        lat, lon = float(lat), float(lon)
                    except (TypeError, ValueError):
                        lat = lon = None
                    break

        return ScrapedItem(
            title=title,
            url=url,
            price=float(price_raw),
            currency="INR",
            condition="used",
            category=str(ad.get("category_id") or ""),
            seller=f"{seller} ({city})" if seller else city,
            latitude=lat,
            longitude=lon,
        )

    @staticmethod
    def _extract_price(price_field: Any) -> float | None:
        """OLX wraps prices like
            {"value": {"raw": 34999.0, "currency": {...}, "display": "₹ 34,999"}}
        """
        if not isinstance(price_field, dict):
            return None
        value = price_field.get("value")
        if isinstance(value, dict) and "raw" in value:
            try:
                return float(value["raw"])
            except (TypeError, ValueError):
                return None
        # Some endpoints return "amount" / "raw" flat
        for key in ("raw", "amount", "value"):
            v = price_field.get(key)
            if v is None:
                continue
            try:
                return float(v)
            except (TypeError, ValueError):
                continue
        return None
