from fastapi import APIRouter

from app.api.admin import grouping, listings, runs, schedule, sites

admin_router = APIRouter(prefix="/admin", tags=["admin"])
admin_router.include_router(sites.router)
admin_router.include_router(schedule.router)
admin_router.include_router(runs.router)
admin_router.include_router(listings.router)
admin_router.include_router(grouping.router)
