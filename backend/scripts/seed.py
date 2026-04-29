"""Seed the database with the working sites configs.

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
# Source: live DB state — 35 sites total.
# To refresh after changing a site's config in admin, re-run this script.
SITES: list[dict] = [
    {'name': 'PCStudio', 'base_url': 'https://www.pcstudio.in', 'scraper_type': 'woocommerce', 'config': {'per_page': 100, 'max_pages': 50, 'request_timeout': 25}},
    {'name': 'ModxComputers', 'base_url': 'https://modxcomputers.com', 'scraper_type': 'api', 'config': {'per_page': 200, 'max_pages': 12, 'request_timeout': 25}},
    {'name': 'Gameloot', 'base_url': 'https://gameloot.in', 'scraper_type': 'static', 'categories': ['shop', 'graphics-card', 'desktop-ram', 'ssd-hdd', 'motherboard', 'buy-cpu', 'power-supply', 'monitors', 'keyboard', 'mice', 'headphones', 'cabinet', 'coolers', 'laptops', 'consoles', 'smart-phones', 'tablets', 'accessories', 'pc-accessories', 'gaming-pc'], 'config': {'selectors': {'product_item': 'div.product_item', 'title': '.product_details h5', 'url': '.product_details a, a.product_item_link', 'price': '.product_price ins .woocommerce-Price-amount, .product_price .woocommerce-Price-amount'}, 'category_urls': {'shop': '/shop/', 'graphics-card': '/product-category/graphics-card/', 'desktop-ram': '/product-category/desktop-ram/', 'ssd-hdd': '/product-category/ssd-hdd/', 'motherboard': '/product-category/motherboard/', 'buy-cpu': '/product-category/buy-cpu/', 'power-supply': '/product-category/power-supply/', 'monitors': '/product-category/monitors/', 'keyboard': '/product-category/keyboard/', 'mice': '/product-category/mice/', 'headphones': '/product-category/headphones/', 'cabinet': '/product-category/cabinet/', 'coolers': '/product-category/coolers/', 'laptops': '/product-category/laptops/', 'consoles': '/product-category/consoles/', 'smart-phones': '/product-category/smart-phones/', 'tablets': '/product-category/tablets/', 'accessories': '/product-category/accessories/', 'pc-accessories': '/product-category/pc-accessories/', 'gaming-pc': '/product-category/gaming-pc/'}, 'pagination_pattern': 'page/{page}/', 'max_pages': 15}},
    {'name': 'GameNation', 'base_url': 'https://gamenation.in', 'scraper_type': 'static', 'categories': ['ps4', 'ps5', 'xbox-one', 'xbox-series-xs', 'nintendo-switch', 'consoles', 'accessories', 'pc-components'], 'config': {'selectors': {'product_item': 'a.product-card-1', 'title': '.product-card-1--middle p', 'url': '', 'price': '.product-price--display p'}, 'category_urls': {'ps4': '/PlayStation/PS4', 'ps5': '/PlayStation/PS5', 'xbox-one': '/Xbox/XboxOne', 'xbox-series-xs': '/Xbox/XboxSeriesXS', 'nintendo-switch': '/Nintendo-Switch/', 'consoles': '/Consoles/', 'accessories': '/Accessories/', 'pc-components': '/PCComponents/'}, 'pagination_pattern': '?Page={page}&OnlyListing=true', 'max_pages': 80}},
    # MDComputers (OpenCart 3.x + Cloudflare): vanilla Playwright gets through
    # the first page or two and then Cloudflare's JS challenge re-flags the
    # session. Same pattern as Acer/Akamai. Switched to a dedicated
    # `scraper_type='api'` (registry name-dispatched to MDComputersScraper)
    # which uses playwright-stealth + a fresh Chromium process per page —
    # the recipe that lifted Acer past Akamai.
    {'name': 'MDComputers', 'base_url': 'https://www.mdcomputers.in', 'scraper_type': 'api', 'categories': ['processor', 'graphics-card', 'motherboard', 'ram', 'ssd', 'hdd', 'smps', 'cpu-cooler', 'cabinet-fan'], 'config': {'category_urls': {'processor': '/catalog/processor', 'graphics-card': '/catalog/graphics-card', 'motherboard': '/catalog/motherboard', 'ram': '/catalog/ram', 'ssd': '/catalog/ssd-drive', 'hdd': '/catalog/hard-drive', 'smps': '/catalog/smps', 'cpu-cooler': '/catalog/cpu-cooler', 'cabinet-fan': '/catalog/cabinet-fan'}, 'max_pages': 4, 'settle_ms': 5000, 'min_delay_s': 8, 'max_delay_s': 15, 'viewport': {'width': 1440, 'height': 900}}},
    {'name': 'EliteHubs', 'base_url': 'https://elitehubs.com', 'scraper_type': 'shopify', 'categories': [], 'config': {'use_full_catalog': True, 'per_page': 250, 'max_pages': 80, 'max_products': 12000, 'concurrency': 1, 'request_timeout': 30}},
    {'name': 'Zoukart', 'base_url': 'https://robkart.com', 'scraper_type': 'woocommerce', 'config': {'per_page': 50, 'max_pages': 10, 'request_timeout': 25}},
    # Vedant Computers (OpenCart): catalog ~700 products. The original 6 categories
    # only covered cooling-related items (~210 listings). Expanded to include all
    # `pc-components/*`, `pc-peripherals/*`, and `pc-systems/*` leaf categories
    # discovered via the homepage navigation. `?page=N` pagination confirmed
    # working (12 products per page); selectors `.product-layout` / `.price-new`
    # validated against the new category pages. `max_pages=12` covers the largest
    # category (motherboard ~136 products); the scraper exits early on empty pages.
    {'name': 'VedantComputers', 'base_url': 'https://www.vedantcomputers.com', 'scraper_type': 'static', 'categories': ['processor', 'motherboard', 'memory', 'storage', 'gpu', 'smps', 'cabinet', 'cpu-cooler', 'customizable-combo', 'hard-disk-drive', 'solid-state-drive', 'case-fan', 'cooler-brackets', 'laptop-cooler', 'thermal-paste', 'capture-cards', 'case-accessories', 'gpu-accessories', 'led-accessories', 'psu-accessories', 'software', 'sound-card', 'wifi-adapter', 'keyboard', 'mouse', 'combo', 'game-pad', 'mouse-pad', 'pen-tablet', 'monitor', 'headset', 'speaker', 'gaming-chair', 'streaming-accessories', 'gaming-laptop', 'pre-build-pc', 'ai-box'], 'config': {'selectors': {'product_item': '.product-layout', 'title': "a[href*='/'][title]", 'url': "a[href*='/'][title]", 'price': '.price-new, .price'}, 'pagination_pattern': '?page={page}', 'max_pages': 12, 'category_urls': {'processor': '/processor', 'motherboard': '/motherboard', 'memory': '/memory', 'storage': '/storage', 'gpu': '/gpu', 'smps': '/smps', 'cabinet': '/cabinet', 'cpu-cooler': '/cpu-cooler', 'customizable-combo': '/customizable-combo', 'hard-disk-drive': '/pc-components/storage/hard-disk-drive', 'solid-state-drive': '/pc-components/storage/solid-state-drive', 'case-fan': '/pc-components/cooling-accessories/case-fan', 'cooler-brackets': '/pc-components/cooling-accessories/cooler-brackets', 'laptop-cooler': '/pc-components/cooling-accessories/laptop-cooler', 'thermal-paste': '/pc-components/cooling-accessories/thermal-paste', 'capture-cards': '/pc-components/add-ons/capture-cards', 'case-accessories': '/pc-components/add-ons/case-accessories', 'gpu-accessories': '/pc-components/add-ons/gpu-accessories', 'led-accessories': '/pc-components/add-ons/led-accessories', 'psu-accessories': '/pc-components/add-ons/psu-accessories', 'software': '/pc-components/add-ons/software', 'sound-card': '/pc-components/add-ons/sound-card', 'wifi-adapter': '/pc-components/add-ons/wifi-adapter', 'keyboard': '/pc-peripherals/input-devices/keyboard', 'mouse': '/pc-peripherals/input-devices/mouse', 'combo': '/pc-peripherals/input-devices/combo', 'game-pad': '/pc-peripherals/input-devices/game-pad', 'mouse-pad': '/pc-peripherals/input-devices/mouse-pad', 'pen-tablet': '/pc-peripherals/input-devices/pen-tablet', 'monitor': '/pc-peripherals/output-devices/monitor', 'headset': '/pc-peripherals/output-devices/headset', 'speaker': '/pc-peripherals/output-devices/speaker', 'gaming-chair': '/pc-peripherals/gaming-chair', 'streaming-accessories': '/pc-peripherals/streaming-accessories', 'gaming-laptop': '/pc-systems/gaming-laptop', 'pre-build-pc': '/pc-systems/pre-build-pc', 'ai-box': '/pc-systems/ai-box'}}},
    {'name': 'Ant-PC', 'base_url': 'https://www.ant-pc.com', 'scraper_type': 'static', 'config': {'max_pages': 1, 'selectors': {'url': 'a.btn-comm', 'price': 'p.startingPrice-numb', 'title': 'h2.box-heading span', 'product_item': '.pListN-box'}, 'category_urls': {'budget-gaming': '/gaming/gaming-desktop/budget-gaming-desktops', 'cad-workstation': '/workstation/engineering/architecture-cad-workstation', 'flagship-gaming': '/gaming/gaming-desktop/flagship-gaming-pcs', 'gpu-workstation': '/workstation/ai-deep-learning-workstations/gpu-workstation', 'audio-workstation': '/workstation/content-creations/digital-audio-workstation', 'performance-gaming': '/gaming/gaming-desktop/performance-gaming-desktops', 'professional-gaming': '/gaming/gaming-desktop/professional-gaming-rigs', 'multi-gpu-workstation': '/workstation/ai-deep-learning-workstations/multi-gpu-workstation', 'trading-multi-monitor': '/workstation/trading/multi-monitor-trading-workstation', 'trading-single-display': '/workstation/trading/single-display-trading-pc', 'photo-video-workstation': '/workstation/content-creations/photo-video-editing-workstation', '3d-animation-workstation': '/workstation/content-creations/3d-animation-design-workstation', '3d-rendering-workstation': '/workstation/engineering/3d-rendering-workstation'}}},
    {'name': 'Zebronics', 'base_url': 'https://zebronics.com', 'scraper_type': 'shopify', 'categories': ['1920x1080-led-monitor-for-office-use', 'aio-cooler', 'atx-pc-case', 'best-atx-gaming-case', 'best-curved-gaming-monitor', 'best-eatx-gaming-case', 'best-ultra-wide-gaming-monitor-2025', 'best-wired-gaming-mouse', 'best-wireless-gaming-mouse', 'budget-cabinet', 'cabinets', 'cctv-power-supply'], 'config': {'category_handles': {'1920x1080-led-monitor-for-office-use': '1920x1080-led-monitor-for-office-use', 'aio-cooler': 'aio-cooler', 'atx-pc-case': 'atx-pc-case', 'best-atx-gaming-case': 'best-atx-gaming-case', 'best-curved-gaming-monitor': 'best-curved-gaming-monitor', 'best-eatx-gaming-case': 'best-eatx-gaming-case', 'best-ultra-wide-gaming-monitor-2025': 'best-ultra-wide-gaming-monitor-2025', 'best-wired-gaming-mouse': 'best-wired-gaming-mouse', 'best-wireless-gaming-mouse': 'best-wireless-gaming-mouse', 'budget-cabinet': 'budget-cabinet', 'cabinets': 'cabinets', 'cctv-power-supply': 'cctv-power-supply'}, 'per_page': 50, 'max_pages': 5, 'request_timeout': 25}},
    {'name': 'ProXPC', 'base_url': 'https://www.proxpc.com', 'scraper_type': 'dynamic', 'categories': ['workstation'], 'config': {'selectors': {'product_item': '[class*="workstation_ProdCol"]', 'title': 'h3', 'url': 'a[href*="/product-details/"]', 'price': '[class*="workstation_price"]'}, 'category_urls': {'workstation': '/workstation/'}, 'pagination_pattern': '?p={page}', 'max_pages': 1, 'wait_selector': '[class*="workstation_price"]', 'scroll_to_bottom': True, 'settle_ms': 3500}},
    {'name': 'PrimeABGB', 'base_url': 'https://www.primeabgb.com', 'scraper_type': 'woocommerce', 'config': {'per_page': 100, 'max_pages': 65, 'request_timeout': 25}},
    {'name': 'PCKumar', 'base_url': 'https://pckumar.in', 'scraper_type': 'woocommerce', 'config': {'per_page': 100, 'max_pages': 60, 'request_timeout': 25}},
    {'name': 'Microcenter', 'base_url': 'https://microcenterindia.com', 'scraper_type': 'shopify', 'categories': [], 'config': {'use_full_catalog': True, 'per_page': 250, 'max_pages': 80, 'max_products': 12000, 'concurrency': 4, 'request_timeout': 25}},
    {'name': 'Computech', 'base_url': 'https://computechstore.in', 'scraper_type': 'api', 'config': {'request_timeout': 25, 'use_sitemap': True, 'sitemap_url': '/product-sitemap.xml', 'max_products': 8000, 'concurrency': 20, 'detail_request_timeout': 20}},
    {'name': 'GamesTheShop', 'base_url': 'https://www.gamestheshop.com', 'scraper_type': 'dynamic', 'categories': ['home'], 'config': {'selectors': {'product_item': 'div.card-inner', 'title': "a[href^='/']", 'url': "a[href^='/']", 'price': '.d-flex.vertical'}, 'category_urls': {'home': '/'}, 'pagination_pattern': '?p={page}', 'max_pages': 1, 'wait_selector': 'div.card-inner', 'settle_ms': 3000, 'scroll_to_bottom': True}},
    {'name': 'Clarion', 'base_url': 'https://shop.clarioncomputers.in', 'scraper_type': 'api', 'config': {'per_page': 200, 'max_pages': 12, 'request_timeout': 25, 'category_slugs': {'graphics-card': 'graphics-card', 'desktop-processors': 'desktop-processors', 'amd-processors': 'amd-processors', 'intel-processors': 'intel-processors', 'motherboards': 'motherboards', 'memory-ram': 'memory-ram', 'storage': 'storage', 'ssd': 'ssd', 'internal-hard-drive': 'internal-hard-drive', 'cabinet': 'cabinet', 'power-supply': 'power-supply', 'cooling-systems': 'cooling-systems', 'monitor': 'monitor', 'gaming-monitors': 'gaming-monitors', 'laptop': 'laptop', 'gaming-laptop': 'gaming-laptop', 'pre-built-pc': 'pre-built-pc', 'mini-pc': 'mini-pc', 'keyboard': 'keyboard', 'mouse': 'mouse', 'headset': 'headset', 'speakers': 'speakers', 'ups': 'ups', 'printer': 'printer', 'projector': 'projector', 'webcam': 'webcam', 'gaming-chairs': 'gaming-chairs', 'accessories': 'accessories', 'networking': 'networking'}}},
    {'name': 'SCLGaming', 'base_url': 'https://sclgaming.in', 'scraper_type': 'woocommerce', 'config': {'per_page': 100, 'max_pages': 90, 'request_timeout': 25}},
    {'name': 'TheMVP', 'base_url': 'http://themvp.in/', 'scraper_type': 'static', 'categories': ['gaming-pc', 'photo-editing-photoshop', 'video-editing-premier'], 'config': {'selectors': {'product_item': '.product', 'title': '.product-title', 'url': "a.product-image, a[href*='/gaming-pc/'], a[href*='/photo-editing-pc/'], a[href*='/video-editing-pc/']", 'price': '.value-text'}, 'category_urls': {'gaming-pc': '/gaming-pc', 'photo-editing-photoshop': '/photo-editing-pc/adobe-photoshop', 'video-editing-premier': '/video-editing-pc/adobe-premier-pro'}, 'pagination_pattern': '?page={page}', 'max_pages': 1, 'request_timeout': 25}},
    {'name': 'Kryptronix', 'base_url': 'https://www.kryptronix.in', 'scraper_type': 'woocommerce', 'config': {'per_page': 50, 'max_pages': 10, 'request_timeout': 25}},
    {'name': 'SMCInternational', 'base_url': 'https://smcinternational.in', 'scraper_type': 'api', 'categories': ['processors', 'motherboard', 'memory', 'graphics-card', 'storage', 'power-supply-unit', 'cpu-coolers', 'case-fans', 'cabinet', 'monitors', 'gaming-keyboards', 'gaming-mice', 'gaming-headsets', 'speakers', 'mouse-pads', 'game-controllers', 'accessories', 'streaming-products'], 'config': {'category_catids': {'processors': 18, 'motherboard': 3, 'memory': 24, 'graphics-card': 31, 'storage': 36, 'power-supply-unit': 23, 'cpu-coolers': 8, 'case-fans': 10, 'cabinet': 6, 'monitors': 22, 'gaming-keyboards': 12, 'gaming-mice': 11, 'gaming-headsets': 13, 'gaming-chairs': 14, 'speakers': 38, 'mouse-pads': 15, 'game-controllers': 17, 'accessories': 26, 'streaming-products': 39, 'simulator-cockpit': 48, 'qnap': 32, 'pre-built-pc': 49}, 'max_pages': 5, 'request_timeout': 25, 'request_delay': 0.4}},
    {'name': 'VoltedPC', 'base_url': 'https://voltedpc.in', 'scraper_type': 'dynamic', 'categories': ['gaming-pcs', 'home-office-pcs', 'video-editing-workstation', 'photo-editing-workstation', 'stock-trading-workstation', 'animation-and-rendering-workstation'], 'config': {'selectors': {'product_item': '.products-item-column', 'title': '.products-item-title a', 'url': '.products-item-title a', 'price': '.products-item-startingPrice'}, 'category_urls': {'gaming-pcs': '/category/gaming-pcs', 'home-office-pcs': '/category/home-office-pcs', 'video-editing-workstation': '/category/video-editing-workstation', 'photo-editing-workstation': '/category/photo-editing-workstation', 'stock-trading-workstation': '/category/stock-trading-workstation', 'animation-and-rendering-workstation': '/category/animation-and-rendering-workstation'}, 'pagination_pattern': '?page={page}', 'max_pages': 1, 'wait_selector': '.products-item-column', 'scroll_to_bottom': True, 'settle_ms': 3500}},
    {'name': 'FusionGaming', 'base_url': 'https://www.fusiongaming.in', 'scraper_type': 'api', 'categories': ['accessories'], 'config': {'category_urls': {'accessories': '/accessories'}, 'settle_ms': 12000}},
    {'name': 'NCLComputer', 'base_url': 'https://nclcomputer.com', 'scraper_type': 'woocommerce', 'config': {'per_page': 50, 'max_pages': 10, 'request_timeout': 25}},
    {'name': 'TheITDepot', 'base_url': 'https://www.theitdepot.com', 'scraper_type': 'static', 'categories': ['processor', 'cooling', 'motherboard', 'storage', 'graphics-card', 'cabinet', 'accessories', 'printers', 'laptops-desktops', 'gaming-products', 'diy-cooling', 'amd-bundle', 'gigabyte-offer'], 'config': {'selectors': {'product_item': '.product-thumb', 'title': 'a.product-img, h4 a, .caption a', 'url': 'a.product-img, h4 a, .caption a', 'price': '.price-new, .price'}, 'pagination_pattern': '&page={page}', 'max_pages': 60, 'category_urls': {'processor': '/index.php?route=product/category&path=2', 'cooling': '/index.php?route=product/category&path=15', 'motherboard': '/index.php?route=product/category&path=31', 'storage': '/index.php?route=product/category&path=78', 'graphics-card': '/index.php?route=product/category&path=88', 'cabinet': '/index.php?route=product/category&path=115', 'accessories': '/index.php?route=product/category&path=146', 'printers': '/index.php?route=product/category&path=153', 'laptops-desktops': '/index.php?route=product/category&path=166', 'gaming-products': '/index.php?route=product/category&path=170', 'diy-cooling': '/index.php?route=product/category&path=506', 'amd-bundle': '/index.php?route=product/category&path=635', 'gigabyte-offer': '/index.php?route=product/category&path=638'}}},
    {'name': 'HP', 'base_url': 'https://www.hp.com/in-en/home.html', 'scraper_type': 'static', 'categories': ['laptops-tablets', 'desktops', 'monitors', 'printers', 'accessories', 'business-laptops', 'personal-laptops', 'business-printers', 'home-printers'], 'config': {'selectors': {'product_item': 'li.product.product-item', 'title': 'a.product-item-link', 'url': 'a.product-item-link', 'price': '.price-wrapper'}, 'category_urls': {'laptops-tablets': '/in-en/shop/laptops-tablets.html', 'desktops': '/in-en/shop/desktops.html', 'monitors': '/in-en/shop/monitors.html', 'printers': '/in-en/shop/printers.html', 'accessories': '/in-en/shop/accessories.html', 'business-laptops': '/in-en/shop/laptops-tablets/business-laptops.html', 'personal-laptops': '/in-en/shop/laptops-tablets/personal-laptops.html', 'business-printers': '/in-en/shop/printers/business-printers.html', 'home-printers': '/in-en/shop/printers/home-and-home-office-printers.html'}, 'pagination_pattern': '?p={page}', 'max_pages': 18, 'request_timeout': 30}},
    # Dell India: dell.com/en-in/shop redirects to dellstore.com (Magento 2,
    # no Akamai). Cards are `li.product.product-item`; numeric price lives on
    # [data-price-amount]; titles are in img[alt] (the carousel duplicates
    # `a.product-item-link` anchors with empty text). Adding
    # ?product_list_limit=36 bumps the page size from the default 9 to 36, so
    # pagination becomes `&p=N`. Catalog ~290 products: laptops (61),
    # desktops (34), monitors (82), accessories (~113).
    {'name': 'Dell', 'base_url': 'https://www.dellstore.com', 'scraper_type': 'dynamic', 'categories': ['laptops', 'desktops', 'monitors', 'accessories'], 'config': {'selectors': {'product_item': 'li.product.product-item', 'title': 'img[alt]', 'url': 'a.product-item-link', 'price': '[data-price-amount], .price-wrapper'}, 'category_urls': {'laptops': '/laptops.html?product_list_limit=36', 'desktops': '/desktops.html?product_list_limit=36', 'monitors': '/monitors.html?product_list_limit=36', 'accessories': '/accessories.html?product_list_limit=36'}, 'pagination_pattern': '&p={page}', 'max_pages': 5, 'wait_selector': 'li.product.product-item', 'settle_ms': 3500, 'scroll_to_bottom': True}},
    {'name': 'Lenovo', 'base_url': 'https://www.lenovo.com/in/en/', 'scraper_type': 'api', 'categories': ['legion', 'thinkpad', 'ideapad', 'thinkbook', 'thinkbook-14', 'thinkbook-16', 'loq', 'desktops', 'thinkcentre', 'workstations', 'thinkstation', 'accessories', 'gaming'], 'config': {'selectors': {'product_item': 'li.product_item', 'title': 'a[href*="/p/"]', 'url': 'a[href*="/p/"]', 'price': 'span.price-title'}, 'category_urls': {'legion': '/in/en/d/legion', 'thinkpad': '/in/en/d/thinkpad', 'ideapad': '/in/en/d/ideapad', 'thinkbook': '/in/en/d/thinkbook', 'thinkbook-14': '/in/en/d/thinkbook-14', 'thinkbook-16': '/in/en/d/thinkbook-16', 'loq': '/in/en/c/laptops/loq-laptops/', 'desktops': '/in/en/d/desktops', 'thinkcentre': '/in/en/c/desktops/thinkcentre', 'workstations': '/in/en/d/workstations', 'thinkstation': '/in/en/c/workstations/thinkstationp/', 'accessories': '/in/en/d/accessories', 'gaming': '/in/en/d/gaming'}, 'pagination_pattern': '?p={page}', 'max_pages': 1, 'wait_selector': 'li.product_item span.price-title', 'scroll_to_bottom': True, 'settle_ms': 15000}},
    {'name': 'Acer', 'base_url': 'https://store.acer.com', 'scraper_type': 'api', 'categories': ['laptops', 'desktops', 'monitors'], 'config': {'category_urls': {'laptops': '/en-in/laptops', 'desktops': '/en-in/desktops', 'monitors': '/en-in/monitors'}, 'max_pages': 4, 'settle_ms': 4000, 'min_delay_s': 15, 'max_delay_s': 30}},
    {'name': 'ASUS', 'base_url': 'https://www.asus.com/in/', 'scraper_type': 'dynamic', 'config': {'selectors': {'product_item': '[class*="ProductCardNormalGrid__productCardContainer"]', 'title': 'h2', 'url': 'a[class*="ProductCardNormalGrid__headingRow"]', 'price': '[class*="ProductCardNormalGrid__priceDiscount"]'}, 'category_urls': {'laptops': '/in/store/laptops/', 'store': '/in/store/'}, 'wait_selector': '[class*="ProductCardNormalGrid__productCardContainer"]', 'scroll_to_bottom': True, 'settle_ms': 2500, 'max_pages': 1}},
    {'name': 'Amazon', 'base_url': 'https://Amazon.in', 'scraper_type': 'api', 'use_proxy': True, 'config': {'search_queries': ['ssd 1tb', 'nvme ssd', 'graphics card', 'rtx 4060', 'rtx 5070', 'ddr4 ram', 'ddr5 ram', 'intel i5 cpu', 'intel i7 cpu', 'ryzen 7 cpu', 'motherboard', 'psu 650w', 'cabinet', 'gaming monitor', 'gaming laptop'], 'department': 'computers', 'max_pages': 3, 'delay_seconds': 2.0, 'request_timeout': 25}},
    {'name': 'Flipkart', 'base_url': 'https://Flipkart.com', 'scraper_type': 'dynamic', 'use_proxy': True, 'categories': ['ssd', 'hdd', 'ram', 'ddr5', 'processor-amd', 'processor-intel', 'graphics-rtx', 'graphics-radeon', 'motherboard', 'psu', 'cabinet', 'cooler', 'monitor', 'keyboard', 'mouse', 'headset', 'laptop-gaming', 'laptop-business'], 'config': {'category_urls': {'ssd': '/search?q=ssd', 'hdd': '/search?q=internal+hard+drive', 'ram': '/search?q=ddr4+ram', 'ddr5': '/search?q=ddr5+ram', 'processor-amd': '/search?q=amd+ryzen+processor', 'processor-intel': '/search?q=intel+core+i7+processor', 'graphics-rtx': '/search?q=nvidia+rtx+graphic+card', 'graphics-radeon': '/search?q=amd+radeon+graphic+card', 'motherboard': '/search?q=motherboard', 'psu': '/search?q=power+supply+unit', 'cabinet': '/search?q=pc+cabinet+gaming', 'cooler': '/search?q=cpu+cooler', 'monitor': '/search?q=gaming+monitor', 'keyboard': '/search?q=mechanical+keyboard', 'mouse': '/search?q=gaming+mouse', 'headset': '/search?q=gaming+headset', 'laptop-gaming': '/search?q=gaming+laptop', 'laptop-business': '/search?q=business+laptop'}, 'selectors': {'product_item': 'div[data-id]', 'title': 'img[alt]', 'url': 'a[href*="/p/itm"]', 'price': '.fb4uj3, ._30jeq3, ._1_WHN1, div[class*=Nx9bqj], div[class*=_30jeq3]'}, 'pagination_pattern': '&page={page}', 'max_pages': 4, 'wait_selector': 'div[data-id]', 'scroll_to_bottom': True, 'settle_ms': 3500}},
    {'name': 'FacebookMarketplace', 'base_url': 'https://www.facebook.com/marketplace/', 'scraper_type': 'location', 'requires_location': True, 'requires_auth': True, 'use_proxy': True, 'config': {'locations': ['mumbai', 'bangalore', 'delhi', 'hyderabad', 'chennai'], 'categories': ['electronics', 'computers', 'laptops'], 'settle_ms': 4000, 'scroll_passes': 3, 'max_items_per_page': 60}},
    {'name': 'OLX', 'base_url': 'https://olx.in', 'scraper_type': 'location', 'requires_location': True, 'config': {'locations': {'Mumbai': 4058997, 'Delhi': 4058659, 'Bangalore': 4058803, 'Hyderabad': 4058804, 'Pune': 4059162}, 'categories': [1505, 1515, 1509], 'search_queries': ['', 'ssd', 'graphic card', 'ram'], 'size': 50, 'max_pages': 2, 'request_timeout': 20}},
    {'name': 'Smartprix', 'base_url': 'https://www.smartprix.com/', 'scraper_type': 'dynamic', 'categories': ['acer-laptops', 'acer-desktops'], 'config': {'category_urls': {'acer-laptops': '/laptops/acer-brand', 'acer-desktops': '/computers/acer-brand'}, 'selectors': {'product_item': '.sm-product', 'title': 'a.name', 'url': 'a.name', 'price': 'span.price'}, 'pagination_pattern': '?page={page}', 'max_pages': 1, 'wait_selector': '.sm-product', 'scroll_to_bottom': True, 'settle_ms': 3500}},
]

DEFAULT_JOB = {
    "name": "Daily scrape — all enabled sites at 6 AM",
    "site_id": None,
    "cron_expression": "0 6 * * *",
    "timezone": "Asia/Kolkata",
    "enabled": True,
}

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
