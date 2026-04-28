"""Configure static-HTML scrape sites that don't have a JSON API.

Hand-tuned configs for OpenCart, older WooCommerce, and custom themes.
Idempotent — re-running just overwrites the same fields.

Usage:
    docker compose exec backend uv run python -m scripts.configure_html_sites
"""
from __future__ import annotations

from app.db.session import SessionLocal
from app.models.site import Site


# Standard WooCommerce theme selectors (Storefront / Astra / OceanWP)
WOOCOMMERCE_HTML = {
    "selectors": {
        "product_item": "li.product",
        "title": "h2.woocommerce-loop-product__title, .woocommerce-loop-product__title",
        "url": "a.woocommerce-LoopProduct-link",
        "price": "span.price",
    },
    "pagination_pattern": "page/{page}/",
    "max_pages": 5,
}

# Standard OpenCart theme selectors
OPENCART_HTML_THUMB = {
    "selectors": {
        "product_item": ".product-thumb",
        "title": "a.product-img, h4 a, .caption a",
        "url": "a.product-img, h4 a, .caption a",
        "price": ".price-new, .price",
    },
    "pagination_pattern": "&page={page}",
    "max_pages": 5,
}
OPENCART_HTML_LAYOUT = {
    "selectors": {
        "product_item": ".product-layout",
        "title": "a[href*='/'][title]",
        "url": "a[href*='/'][title]",
        "price": ".price-new, .price",
    },
    "pagination_pattern": "?page={page}",
    "max_pages": 5,
}

CONFIGS: dict[str, dict] = {
    # === Gameloot — custom WP theme; selectors verified ===
    "Gameloot": {
        "selectors": {
            "product_item": "div.product",
            "title": ".product_details h5",
            "url": ".product_details a, a.product_item_link",
            "price": ".product_price ins .woocommerce-Price-amount, .product_price .woocommerce-Price-amount",
        },
        "category_urls": {
            "shop": "/shop/",
        },
        "pagination_pattern": "page/{page}/",
        "max_pages": 5,
    },

    # === Zoukart — handled separately as woocommerce via robkart.com (its actual store) ===
    # Skipped here on purpose; see DB state set in earlier session.

    # === OpenCart sites ===
    "TheITDepot": {
        **OPENCART_HTML_THUMB,
        "category_urls": {
            "processor": "/index.php?route=product/category&path=2_9_544",
            "ram": "/index.php?route=product/category&path=2_9_545",
            "storage-ssd": "/index.php?route=product/category&path=2_9_547",
            "fans-cooling": "/index.php?route=product/category&path=15_25_508",
            "graphics-cards": "/index.php?route=product/category&path=15_506",
            "motherboard": "/index.php?route=product/category&path=15_506_526",
        },
    },
    "VedantComputers": {
        **OPENCART_HTML_LAYOUT,
        "category_urls": {
            "gpu": "/gpu",
            "cabinet": "/cabinet",
            "cpu-cooler": "/cpu-cooler",
            "cooling-accessories": "/cooling-accessories",
            "add-ons": "/add-ons",
            "customizable-combo": "/customizable-combo",
        },
    },

}

# === Sites that need Playwright (dynamic) ===
DYNAMIC_CONFIGS: dict[str, dict] = {
    "Clarion": {
        "selectors": {
            "product_item": ".product-card",
            "title": "a.product-name",
            "url": "a.product-name",
            "price": ".special-price, .product-price",
        },
        "category_urls": {
            "home": "/",
        },
        "pagination_pattern": "?page={page}",
        "max_pages": 1,
        "wait_selector": "a.product-name",
        "settle_ms": 3000,
        "scroll_to_bottom": True,
    },
    "GamesTheShop": {
        "selectors": {
            "product_item": "div.card-inner",
            "title": "a[href^='/']",
            "url": "a[href^='/']",
            "price": ".d-flex.vertical",
        },
        "category_urls": {
            "home": "/",
        },
        "pagination_pattern": "?p={page}",
        "max_pages": 1,
        "wait_selector": "div.card-inner",
        "settle_ms": 3000,
        "scroll_to_bottom": True,
    },
}


def apply() -> None:
    db = SessionLocal()
    try:
        for name, cfg in CONFIGS.items():
            site = db.query(Site).filter(Site.name == name).first()
            if not site:
                print(f"  ! site '{name}' not found in DB, skipping")
                continue
            site.scraper_type = "static"
            site.enabled = True
            site.last_status = None
            site.config = cfg
            site.categories = list((cfg.get("category_urls") or {}).keys())
            print(f"  {name}: configured static, {len(site.categories)} categories")
        for name, cfg in DYNAMIC_CONFIGS.items():
            site = db.query(Site).filter(Site.name == name).first()
            if not site:
                print(f"  ! site '{name}' not found in DB, skipping")
                continue
            site.scraper_type = "dynamic"
            site.enabled = True
            site.last_status = None
            site.config = cfg
            site.categories = list((cfg.get("category_urls") or {}).keys())
            print(f"  {name}: configured dynamic, {len(site.categories)} categories")
        db.commit()
        print("Done.")
    finally:
        db.close()


if __name__ == "__main__":
    apply()
