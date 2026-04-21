"""
Seed the database with the 34 sites from the requirements doc and a default 6 AM job.

Run via:
    make seed
or:
    docker compose exec backend uv run python -m scripts.seed
"""
from __future__ import annotations

from app.db.session import SessionLocal
from app.models.schedule_job import ScheduleJob
from app.models.site import Site

# Only PCStudio has a working scraper config out of the box.
# Other sites have empty config — you configure selectors later via the admin UI.
PCSTUDIO_CONFIG = {
    "category_urls": {
        "ssds": "/collections/internal-ssd",
        "ram": "/collections/ram",
        "processors": "/collections/processors",
        "gpus": "/collections/graphics-card",
        "motherboards": "/collections/motherboards",
        "power-supplies": "/collections/power-supply",
    },
    "selectors": {
        "product_item": ".grid-product, .grid__item .product-card, li.grid__item",
        "title": ".grid-product__title, .product-card__title, .product__title",
        "url": "a.grid-product__link, a.product-card__link, a.full-unstyled-link",
        "price": ".grid-product__price, .product-card__price, .price",
    },
    "pagination_pattern": "?page={page}",
    "max_pages": 3,
}

SITES: list[dict] = [
    # --- Tier 1: Indian PC / gaming stores (static HTML) ---
    {"name": "PCStudio", "base_url": "https://www.pcstudio.in",
     "scraper_type": "static", "config": PCSTUDIO_CONFIG,
     "categories": list(PCSTUDIO_CONFIG["category_urls"].keys())},

    {"name": "ModxComputers", "base_url": "https://modxcomputers.com",
     "scraper_type": "static"},
    {"name": "Gameloot", "base_url": "https://gameloot.in",
     "scraper_type": "static"},
    {"name": "GameNation", "base_url": "https://gamenation.in",
     "scraper_type": "static"},
    {"name": "MDComputers", "base_url": "https://www.mdcomputers.in",
     "scraper_type": "static"},
    {"name": "EliteHubs", "base_url": "https://elitehubs.com",
     "scraper_type": "static"},
    {"name": "Zoukart", "base_url": "https://zoukart.com",
     "scraper_type": "static"},
    {"name": "VedantComputers", "base_url": "https://www.vedantcomputers.com",
     "scraper_type": "static"},
    {"name": "Ant-PC", "base_url": "https://www.ant-pc.com",
     "scraper_type": "static"},
    {"name": "Zebronics", "base_url": "https://zebronics.com",
     "scraper_type": "static"},
    {"name": "ProXPC", "base_url": "https://www.proxpc.com",
     "scraper_type": "static"},
    {"name": "PrimeABGB", "base_url": "https://www.primeabgb.com",
     "scraper_type": "static"},
    {"name": "PCKumar", "base_url": "https://pckumar.in",
     "scraper_type": "static"},
    {"name": "Microcenter", "base_url": "https://microcenterindia.com",
     "scraper_type": "static"},
    {"name": "Computech", "base_url": "https://computechstore.in",
     "scraper_type": "static"},
    {"name": "GamesTheShop", "base_url": "https://www.gamestheshop.com",
     "scraper_type": "static"},
    {"name": "Clarion", "base_url": "https://shop.clarioncomputers.in",
     "scraper_type": "static"},
    {"name": "SCLGaming", "base_url": "https://sclgaming.in",
     "scraper_type": "static"},
    {"name": "TheMVP", "base_url": "https://themvp.in",
     "scraper_type": "static"},
    {"name": "Kryptronix", "base_url": "https://www.kryptronix.in",
     "scraper_type": "static"},
    {"name": "SMCInternational", "base_url": "https://smcinternational.in",
     "scraper_type": "static"},
    {"name": "VoltedPC", "base_url": "https://voltedpc.in",
     "scraper_type": "static"},
    {"name": "FusionGaming", "base_url": "https://www.fusiongaming.in",
     "scraper_type": "static"},
    {"name": "NCLComputer", "base_url": "https://nclcomputer.com",
     "scraper_type": "static"},
    {"name": "TheITDepot", "base_url": "https://www.theitdepot.com",
     "scraper_type": "static"},

    # --- Tier 2: Brand stores ---
    {"name": "HP", "base_url": "https://www.hp.com/in-en/home.html",
     "scraper_type": "dynamic"},
    {"name": "Dell", "base_url": "https://www.dell.com/en-in",
     "scraper_type": "dynamic"},
    {"name": "Lenovo", "base_url": "https://www.lenovo.com/in/en/",
     "scraper_type": "dynamic"},
    {"name": "Acer", "base_url": "https://www.acer.com/in-en",
     "scraper_type": "dynamic"},
    {"name": "ASUS", "base_url": "https://www.asus.com/in/",
     "scraper_type": "dynamic"},

    # --- Tier 3: Marketplaces (anti-bot + proxies) ---
    {"name": "Amazon", "base_url": "https://Amazon.in",
     "scraper_type": "dynamic", "use_proxy": True},
    {"name": "Flipkart", "base_url": "https://Flipkart.com",
     "scraper_type": "dynamic", "use_proxy": True},

    # --- Tier 4: Location-based (FB + OLX) ---
    {"name": "FacebookMarketplace", "base_url": "https://www.facebook.com/marketplace/",
     "scraper_type": "location", "requires_location": True, "requires_auth": True,
     "use_proxy": True},
    {"name": "OLX", "base_url": "https://olx.in",
     "scraper_type": "location", "requires_location": True},
]

DEFAULT_JOB = {
    "name": "Daily scrape — all enabled sites at 6 AM",
    "site_id": None,
    "cron_expression": "0 6 * * *",
    "timezone": "Asia/Kolkata",
    "enabled": True,
}


def seed() -> None:
    db = SessionLocal()
    try:
        added_sites = 0
        skipped_sites = 0
        for data in SITES:
            existing = db.query(Site).filter(Site.name == data["name"]).first()
            if existing:
                skipped_sites += 1
                continue
            db.add(Site(
                name=data["name"],
                base_url=data["base_url"],
                scraper_type=data.get("scraper_type", "static"),
                enabled=data.get("enabled", True),
                requires_location=data.get("requires_location", False),
                requires_auth=data.get("requires_auth", False),
                config=data.get("config", {}),
                categories=data.get("categories", []),
                concurrent_requests=data.get("concurrent_requests", 4),
                download_delay_seconds=data.get("download_delay_seconds", 2.0),
                use_proxy=data.get("use_proxy", False),
            ))
            added_sites += 1
        db.commit()
        print(f"Sites: {added_sites} added, {skipped_sites} already existed "
              f"(total {added_sites + skipped_sites})")

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
