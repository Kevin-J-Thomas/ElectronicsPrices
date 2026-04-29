"""Seed the database with the 34 sites — full working configs.

Loads (or refreshes) every site row with the scraper_type, config selectors,
category URLs, and base URL needed for that site to actually scrape. Re-running
is idempotent and updates existing rows in place, so deploying a config change
is just `make seed`.

Run via:
    make seed
or:
    docker compose exec backend uv run python -m scripts.seed
"""
from __future__ import annotations

from app.db.session import SessionLocal
from app.models.schedule_job import ScheduleJob
from app.models.site import Site

# AUTO-GENERATED list of sites with full working configs.
# Source: live DB state on 2026-04-29 — 34 sites, 13,942 listings.
# To refresh after changing a site's config in admin, re-run this script.
SITES: list[dict] = [
    {'name': 'PCStudio', 'base_url': 'https://www.pcstudio.in', 'scraper_type': 'static', 'categories': ['processor', 'ram', 'storage', 'graphics-card', 'motherboard', 'power-supply'], 'config': {'category_urls': {'processor': '/product-category/processor/', 'ram': '/product-category/ram/', 'storage': '/product-category/storage/', 'graphics-card': '/product-category/graphics-card/', 'motherboard': '/product-category/motherboard/', 'power-supply': '/product-category/power-supply/'}, 'selectors': {'product_item': 'li.product.type-product', 'title': 'li.title h2 a', 'url': 'li.title h2 a', 'price': '.price-wrap ins .woocommerce-Price-amount'}, 'pagination_pattern': 'page/{page}/', 'max_pages': 2}},
    {'name': 'ModxComputers', 'base_url': 'https://modxcomputers.com', 'scraper_type': 'api', 'config': {'per_page': 200, 'max_pages': 12, 'request_timeout': 25}},
    {'name': 'Gameloot', 'base_url': 'https://gameloot.in', 'scraper_type': 'static', 'categories': ['shop'], 'config': {'selectors': {'product_item': 'div.product', 'title': '.product_details h5', 'url': '.product_details a, a.product_item_link', 'price': '.product_price ins .woocommerce-Price-amount, .product_price .woocommerce-Price-amount'}, 'category_urls': {'shop': '/shop/'}, 'pagination_pattern': 'page/{page}/', 'max_pages': 5}},
    {'name': 'GameNation', 'base_url': 'https://gamenation.in', 'scraper_type': 'dynamic', 'categories': ['home'], 'config': {'selectors': {'product_item': 'a.product-card-1', 'title': '.product-card-1--middle p', 'url': '', 'price': '.product-price--display p'}, 'category_urls': {'home': '/'}, 'pagination_pattern': '?page={page}', 'max_pages': 1, 'wait_selector': 'a.product-card-1', 'scroll_to_bottom': True, 'settle_ms': 4500}},
    {'name': 'MDComputers', 'base_url': 'https://www.mdcomputers.in', 'scraper_type': 'dynamic', 'categories': ['home'], 'config': {'selectors': {'product_item': '.product-grid-item', 'title': '.product-entities-title a, img[alt]', 'url': '.product-entities-title a, a.product-image-link', 'price': '.price .ins'}, 'category_urls': {'home': '/'}, 'pagination_pattern': '?p={page}', 'max_pages': 1, 'wait_selector': '.product-grid-item', 'scroll_to_bottom': True, 'settle_ms': 4500}},
    {'name': 'EliteHubs', 'base_url': 'https://elitehubs.com', 'scraper_type': 'shopify', 'categories': ['processor', 'ram', 'graphics-card', 'ssd', 'motherboard', 'power-supply'], 'config': {'category_handles': {'processor': 'processor', 'ram': 'ram', 'graphics-card': 'graphic-cards', 'ssd': 'ssd', 'motherboard': 'motherboard', 'power-supply': 'power-supply-unit-psu'}, 'per_page': 50, 'max_pages': 5, 'request_timeout': 25}},
    {'name': 'Zoukart', 'base_url': 'https://robkart.com', 'scraper_type': 'woocommerce', 'config': {'per_page': 50, 'max_pages': 10, 'request_timeout': 25}},
    {'name': 'VedantComputers', 'base_url': 'https://www.vedantcomputers.com', 'scraper_type': 'static', 'categories': ['gpu', 'cabinet', 'cpu-cooler', 'cooling-accessories', 'add-ons', 'customizable-combo'], 'config': {'selectors': {'product_item': '.product-layout', 'title': "a[href*='/'][title]", 'url': "a[href*='/'][title]", 'price': '.price-new, .price'}, 'pagination_pattern': '?page={page}', 'max_pages': 5, 'category_urls': {'gpu': '/gpu', 'cabinet': '/cabinet', 'cpu-cooler': '/cpu-cooler', 'cooling-accessories': '/cooling-accessories', 'add-ons': '/add-ons', 'customizable-combo': '/customizable-combo'}}},
    {'name': 'Ant-PC', 'base_url': 'https://www.ant-pc.com', 'scraper_type': 'static', 'config': {'max_pages': 1, 'selectors': {'url': 'a.btn-comm', 'price': 'p.startingPrice-numb', 'title': 'h2.box-heading span', 'product_item': '.pListN-box'}, 'category_urls': {'budget-gaming': '/gaming/gaming-desktop/budget-gaming-desktops', 'cad-workstation': '/workstation/engineering/architecture-cad-workstation', 'flagship-gaming': '/gaming/gaming-desktop/flagship-gaming-pcs', 'gpu-workstation': '/workstation/ai-deep-learning-workstations/gpu-workstation', 'audio-workstation': '/workstation/content-creations/digital-audio-workstation', 'performance-gaming': '/gaming/gaming-desktop/performance-gaming-desktops', 'professional-gaming': '/gaming/gaming-desktop/professional-gaming-rigs', 'multi-gpu-workstation': '/workstation/ai-deep-learning-workstations/multi-gpu-workstation', 'trading-multi-monitor': '/workstation/trading/multi-monitor-trading-workstation', 'trading-single-display': '/workstation/trading/single-display-trading-pc', 'photo-video-workstation': '/workstation/content-creations/photo-video-editing-workstation', '3d-animation-workstation': '/workstation/content-creations/3d-animation-design-workstation', '3d-rendering-workstation': '/workstation/engineering/3d-rendering-workstation'}}},
    {'name': 'Zebronics', 'base_url': 'https://zebronics.com', 'scraper_type': 'shopify', 'categories': ['1920x1080-led-monitor-for-office-use', 'aio-cooler', 'atx-pc-case', 'best-atx-gaming-case', 'best-curved-gaming-monitor', 'best-eatx-gaming-case', 'best-ultra-wide-gaming-monitor-2025', 'best-wired-gaming-mouse', 'best-wireless-gaming-mouse', 'budget-cabinet', 'cabinets', 'cctv-power-supply'], 'config': {'category_handles': {'1920x1080-led-monitor-for-office-use': '1920x1080-led-monitor-for-office-use', 'aio-cooler': 'aio-cooler', 'atx-pc-case': 'atx-pc-case', 'best-atx-gaming-case': 'best-atx-gaming-case', 'best-curved-gaming-monitor': 'best-curved-gaming-monitor', 'best-eatx-gaming-case': 'best-eatx-gaming-case', 'best-ultra-wide-gaming-monitor-2025': 'best-ultra-wide-gaming-monitor-2025', 'best-wired-gaming-mouse': 'best-wired-gaming-mouse', 'best-wireless-gaming-mouse': 'best-wireless-gaming-mouse', 'budget-cabinet': 'budget-cabinet', 'cabinets': 'cabinets', 'cctv-power-supply': 'cctv-power-supply'}, 'per_page': 50, 'max_pages': 5, 'request_timeout': 25}},
    {'name': 'ProXPC', 'base_url': 'https://www.proxpc.com', 'scraper_type': 'dynamic', 'categories': ['workstation'], 'config': {'selectors': {'product_item': '[class*="workstation_ProdCol"]', 'title': 'h3', 'url': 'a[href*="/product-details/"]', 'price': '[class*="workstation_price"]'}, 'category_urls': {'workstation': '/workstation/'}, 'pagination_pattern': '?p={page}', 'max_pages': 1, 'wait_selector': '[class*="workstation_price"]', 'scroll_to_bottom': True, 'settle_ms': 3500}},
    {'name': 'PrimeABGB', 'base_url': 'https://www.primeabgb.com', 'scraper_type': 'woocommerce', 'config': {'per_page': 50, 'max_pages': 10, 'request_timeout': 25}},
    {'name': 'PCKumar', 'base_url': 'https://pckumar.in', 'scraper_type': 'woocommerce', 'config': {'per_page': 50, 'max_pages': 10, 'request_timeout': 25}},
    {'name': 'Microcenter', 'base_url': 'https://microcenterindia.com', 'scraper_type': 'shopify', 'categories': ['2k-professional-monitors', '4k-professional-monitors', 'aio-coolers', 'air-cooler', 'am4-motherboards', 'am5-motherboards', 'amd-cpu', 'amd-gpus', 'amd-motherboard', 'atx-cabinet', 'basic-monitors', 'cabinet-fans'], 'config': {'category_handles': {'2k-professional-monitors': '2k-professional-monitors', '4k-professional-monitors': '4k-professional-monitors', 'aio-coolers': 'aio-coolers', 'air-cooler': 'air-cooler', 'am4-motherboards': 'am4-motherboards', 'am5-motherboards': 'am5-motherboards', 'amd-cpu': 'amd-cpu', 'amd-gpus': 'amd-gpus', 'amd-motherboard': 'amd-motherboard', 'atx-cabinet': 'atx-cabinet', 'basic-monitors': 'basic-monitors', 'cabinet-fans': 'cabinet-fans'}, 'per_page': 50, 'max_pages': 5, 'request_timeout': 25}},
    {'name': 'Computech', 'base_url': 'https://computechstore.in', 'scraper_type': 'api', 'config': {'request_timeout': 25}},
    {'name': 'GamesTheShop', 'base_url': 'https://www.gamestheshop.com', 'scraper_type': 'dynamic', 'categories': ['home'], 'config': {'selectors': {'product_item': 'div.card-inner', 'title': "a[href^='/']", 'url': "a[href^='/']", 'price': '.d-flex.vertical'}, 'category_urls': {'home': '/'}, 'pagination_pattern': '?p={page}', 'max_pages': 1, 'wait_selector': 'div.card-inner', 'settle_ms': 3000, 'scroll_to_bottom': True}},
    {'name': 'Clarion', 'base_url': 'https://shop.clarioncomputers.in', 'scraper_type': 'dynamic', 'categories': ['home'], 'config': {'selectors': {'product_item': '.product-card', 'title': 'a.product-name', 'url': 'a.product-name', 'price': '.special-price, .product-price'}, 'category_urls': {'home': '/'}, 'pagination_pattern': '?page={page}', 'max_pages': 1, 'wait_selector': 'a.product-name', 'settle_ms': 3000, 'scroll_to_bottom': True}},
    {'name': 'SCLGaming', 'base_url': 'https://sclgaming.in', 'scraper_type': 'woocommerce', 'config': {'per_page': 50, 'max_pages': 10, 'request_timeout': 25}},
    {'name': 'TheMVP', 'base_url': 'http://themvp.in/', 'scraper_type': 'static', 'categories': ['gaming-pc', 'photo-editing-photoshop', 'video-editing-premier'], 'config': {'selectors': {'product_item': '.product', 'title': '.product-title', 'url': "a.product-image, a[href*='/gaming-pc/'], a[href*='/photo-editing-pc/'], a[href*='/video-editing-pc/']", 'price': '.value-text'}, 'category_urls': {'gaming-pc': '/gaming-pc', 'photo-editing-photoshop': '/photo-editing-pc/adobe-photoshop', 'video-editing-premier': '/video-editing-pc/adobe-premier-pro'}, 'pagination_pattern': '?page={page}', 'max_pages': 1, 'request_timeout': 25}},
    {'name': 'Kryptronix', 'base_url': 'https://www.kryptronix.in', 'scraper_type': 'woocommerce', 'config': {'per_page': 50, 'max_pages': 10, 'request_timeout': 25}},
    {'name': 'SMCInternational', 'base_url': 'https://smcinternational.in', 'scraper_type': 'static', 'categories': ['home'], 'config': {'selectors': {'product_item': '.product-card', 'title': '.product-card-title a', 'url': '.product-card-title a, .product-card-link', 'price': '.product-card-price'}, 'category_urls': {'home': '/'}, 'pagination_pattern': '?page={page}', 'max_pages': 1}},
    {'name': 'VoltedPC', 'base_url': 'https://voltedpc.in', 'scraper_type': 'dynamic', 'categories': ['gaming-pcs', 'home-office-pcs', 'video-editing-workstation', 'photo-editing-workstation', 'stock-trading-workstation', 'animation-and-rendering-workstation'], 'config': {'selectors': {'product_item': '.products-item-column', 'title': '.products-item-title a', 'url': '.products-item-title a', 'price': '.products-item-startingPrice'}, 'category_urls': {'gaming-pcs': '/category/gaming-pcs', 'home-office-pcs': '/category/home-office-pcs', 'video-editing-workstation': '/category/video-editing-workstation', 'photo-editing-workstation': '/category/photo-editing-workstation', 'stock-trading-workstation': '/category/stock-trading-workstation', 'animation-and-rendering-workstation': '/category/animation-and-rendering-workstation'}, 'pagination_pattern': '?page={page}', 'max_pages': 1, 'wait_selector': '.products-item-column', 'scroll_to_bottom': True, 'settle_ms': 3500}},
    {'name': 'FusionGaming', 'base_url': 'https://www.fusiongaming.in', 'scraper_type': 'api', 'categories': ['accessories'], 'config': {'category_urls': {'accessories': '/accessories'}, 'settle_ms': 12000}},
    {'name': 'NCLComputer', 'base_url': 'https://nclcomputer.com', 'scraper_type': 'woocommerce', 'config': {'per_page': 50, 'max_pages': 10, 'request_timeout': 25}},
    {'name': 'TheITDepot', 'base_url': 'https://www.theitdepot.com', 'scraper_type': 'static', 'categories': ['processor', 'ram', 'storage-ssd', 'fans-cooling', 'graphics-cards', 'motherboard'], 'config': {'selectors': {'product_item': '.product-thumb', 'title': 'a.product-img, h4 a, .caption a', 'url': 'a.product-img, h4 a, .caption a', 'price': '.price-new, .price'}, 'pagination_pattern': '&page={page}', 'max_pages': 5, 'category_urls': {'processor': '/index.php?route=product/category&path=2_9_544', 'ram': '/index.php?route=product/category&path=2_9_545', 'storage-ssd': '/index.php?route=product/category&path=2_9_547', 'fans-cooling': '/index.php?route=product/category&path=15_25_508', 'graphics-cards': '/index.php?route=product/category&path=15_506', 'motherboard': '/index.php?route=product/category&path=15_506_526'}}},
    {'name': 'HP', 'base_url': 'https://www.hp.com/in-en/home.html', 'scraper_type': 'static', 'categories': ['laptops-tablets', 'gaming-laptops', 'business-laptops', 'personal-laptops'], 'config': {'selectors': {'product_item': '.product-item', 'title': 'a.product-item-link', 'url': 'a.product-item-link', 'price': '.price-wrapper'}, 'category_urls': {'laptops-tablets': '/in-en/shop/laptops-tablets.html', 'gaming-laptops': '/in-en/shop/gaming-laptops', 'business-laptops': '/in-en/shop/business-laptops', 'personal-laptops': '/in-en/shop/personal-laptops'}, 'pagination_pattern': '?p={page}', 'max_pages': 3, 'request_timeout': 30}},
    {'name': 'Dell', 'base_url': 'https://www.dell.com/en-in', 'scraper_type': 'dynamic', 'categories': ['all-laptops', 'gaming-laptops', 'business-laptops'], 'config': {'selectors': {'product_item': '.product-item', 'title': '.product-item-name, a.product-item-link', 'url': 'a.product-item-link', 'price': '.price-wrapper'}, 'category_urls': {'all-laptops': '/en-in/shop/scc/sc/laptops', 'gaming-laptops': '/en-in/shop/scc/sc/gaming-laptops', 'business-laptops': '/en-in/shop/scc/sc/business-laptops'}, 'pagination_pattern': '?p={page}', 'max_pages': 3, 'wait_selector': '.product-item', 'settle_ms': 3000, 'scroll_to_bottom': True}},
    {'name': 'Lenovo', 'base_url': 'https://www.smartprix.com/', 'scraper_type': 'dynamic', 'categories': ['laptops', 'desktops'], 'config': {'category_urls': {'laptops': '/laptops/lenovo-brand', 'desktops': '/computers/lenovo-brand'}, 'selectors': {'product_item': '.sm-product', 'title': 'a.name', 'url': 'a.name', 'price': 'span.price'}, 'pagination_pattern': '?page={page}', 'max_pages': 1, 'wait_selector': '.sm-product', 'scroll_to_bottom': True, 'settle_ms': 3500}},
    {'name': 'Acer', 'base_url': 'https://www.smartprix.com/', 'scraper_type': 'dynamic', 'categories': ['laptops', 'desktops'], 'config': {'category_urls': {'laptops': '/laptops/acer-brand', 'desktops': '/computers/acer-brand'}, 'selectors': {'product_item': '.sm-product', 'title': 'a.name', 'url': 'a.name', 'price': 'span.price'}, 'pagination_pattern': '?page={page}', 'max_pages': 1, 'wait_selector': '.sm-product', 'scroll_to_bottom': True, 'settle_ms': 3500}},
    {'name': 'ASUS', 'base_url': 'https://www.asus.com/in/', 'scraper_type': 'dynamic', 'config': {'selectors': {'product_item': '[class*="ProductCardNormalGrid__productCardContainer"]', 'title': 'h2', 'url': 'a[class*="ProductCardNormalGrid__headingRow"]', 'price': '[class*="ProductCardNormalGrid__priceDiscount"]'}, 'category_urls': {'laptops': '/in/store/laptops/', 'store': '/in/store/'}, 'wait_selector': '[class*="ProductCardNormalGrid__productCardContainer"]', 'scroll_to_bottom': True, 'settle_ms': 2500, 'max_pages': 1}},
    {'name': 'Amazon', 'base_url': 'https://Amazon.in', 'scraper_type': 'api', 'use_proxy': True, 'config': {'search_queries': ['ssd 1tb', 'nvme ssd', 'graphics card', 'rtx 4060', 'rtx 5070', 'ddr4 ram', 'ddr5 ram', 'intel i5 cpu', 'intel i7 cpu', 'ryzen 7 cpu', 'motherboard', 'psu 650w', 'cabinet', 'gaming monitor', 'gaming laptop'], 'department': 'computers', 'max_pages': 3, 'delay_seconds': 2.0, 'request_timeout': 25}},
    {'name': 'Flipkart', 'base_url': 'https://Flipkart.com', 'scraper_type': 'dynamic', 'use_proxy': True, 'categories': ['ssd', 'hdd', 'ram', 'ddr5', 'processor-amd', 'processor-intel', 'graphics-rtx', 'graphics-radeon', 'motherboard', 'psu', 'cabinet', 'cooler', 'monitor', 'keyboard', 'mouse', 'headset', 'laptop-gaming', 'laptop-business'], 'config': {'category_urls': {'ssd': '/search?q=ssd', 'hdd': '/search?q=internal+hard+drive', 'ram': '/search?q=ddr4+ram', 'ddr5': '/search?q=ddr5+ram', 'processor-amd': '/search?q=amd+ryzen+processor', 'processor-intel': '/search?q=intel+core+i7+processor', 'graphics-rtx': '/search?q=nvidia+rtx+graphic+card', 'graphics-radeon': '/search?q=amd+radeon+graphic+card', 'motherboard': '/search?q=motherboard', 'psu': '/search?q=power+supply+unit', 'cabinet': '/search?q=pc+cabinet+gaming', 'cooler': '/search?q=cpu+cooler', 'monitor': '/search?q=gaming+monitor', 'keyboard': '/search?q=mechanical+keyboard', 'mouse': '/search?q=gaming+mouse', 'headset': '/search?q=gaming+headset', 'laptop-gaming': '/search?q=gaming+laptop', 'laptop-business': '/search?q=business+laptop'}, 'selectors': {'product_item': 'div[data-id]', 'title': 'img[alt]', 'url': 'a[href*="/p/itm"]', 'price': '.fb4uj3, ._30jeq3, ._1_WHN1, div[class*=Nx9bqj], div[class*=_30jeq3]'}, 'pagination_pattern': '&page={page}', 'max_pages': 4, 'wait_selector': 'div[data-id]', 'scroll_to_bottom': True, 'settle_ms': 3500}},
    {'name': 'FacebookMarketplace', 'base_url': 'https://www.facebook.com/marketplace/', 'scraper_type': 'location', 'requires_location': True, 'requires_auth': True, 'use_proxy': True, 'config': {'locations': ['mumbai', 'bangalore', 'delhi', 'hyderabad', 'chennai'], 'categories': ['electronics', 'computers', 'laptops'], 'settle_ms': 4000, 'scroll_passes': 3, 'max_items_per_page': 60}},
    {'name': 'OLX', 'base_url': 'https://olx.in', 'scraper_type': 'location', 'requires_location': True, 'config': {'locations': {'Mumbai': 4058997, 'Delhi': 4058659, 'Bangalore': 4058803, 'Hyderabad': 4058804, 'Pune': 4059162}, 'categories': [1505, 1515, 1509], 'search_queries': ['', 'ssd', 'graphic card', 'ram'], 'size': 50, 'max_pages': 2, 'request_timeout': 20}},
]

DEFAULT_JOB = {
    "name": "Daily scrape — all enabled sites at 6 AM",
    "site_id": None,
    "cron_expression": "0 6 * * *",
    "timezone": "Asia/Kolkata",
    "enabled": True,
}

# Fields seed will set on every run (so config drift in the DB gets reset to
# the source of truth in this file).
SYNCED_FIELDS = (
    "base_url", "scraper_type", "enabled", "requires_location",
    "requires_auth", "use_proxy", "concurrent_requests",
    "download_delay_seconds", "categories", "config",
)

DEFAULTS = {
    "enabled": True,
    "requires_location": False,
    "requires_auth": False,
    "use_proxy": False,
    "concurrent_requests": 4,
    "download_delay_seconds": 2.0,
    "categories": [],
    "config": {},
}


def seed() -> None:
    db = SessionLocal()
    try:
        added = updated = 0
        for data in SITES:
            existing = db.query(Site).filter(Site.name == data["name"]).first()
            if existing is None:
                row = Site(name=data["name"])
                for key in SYNCED_FIELDS:
                    setattr(row, key, data.get(key, DEFAULTS.get(key)))
                db.add(row)
                added += 1
            else:
                changed = False
                for key in SYNCED_FIELDS:
                    new_val = data.get(key, DEFAULTS.get(key))
                    if getattr(existing, key) != new_val:
                        setattr(existing, key, new_val)
                        changed = True
                if changed:
                    updated += 1
        db.commit()
        print(f"Sites: {added} added, {updated} updated, "
              f"{len(SITES) - added - updated} unchanged "
              f"(total {len(SITES)})")

        existing_job = (
            db.query(ScheduleJob)
            .filter(ScheduleJob.name == DEFAULT_JOB["name"])
            .first()
        )
        if existing_job:
            print("Default schedule job already exists — skipping")
        else:
            db.add(ScheduleJob(**DEFAULT_JOB))
            db.commit()
            print(f"Created schedule job: {DEFAULT_JOB['name']} "
                  f"(cron='{DEFAULT_JOB['cron_expression']}' "
                  f"tz={DEFAULT_JOB['timezone']})")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
