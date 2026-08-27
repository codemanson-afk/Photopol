from fastapi import APIRouter

from app.api.routes import admin, auth, batches, billing, credits, dashboard, guest, health, jobs, packs, projects

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(guest.router, prefix="/guest", tags=["guest"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(batches.router, prefix="/batches", tags=["batches"])
api_router.include_router(packs.router, prefix="/exports", tags=["exports"])
api_router.include_router(credits.router, prefix="/credits", tags=["credits"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(billing.router, prefix="/billing", tags=["billing"])

# marker so we can confirm this module is loaded by the running server
API_ROUTER_BUILD = "phase3-v1"
