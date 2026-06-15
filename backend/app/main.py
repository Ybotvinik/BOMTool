from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import (
    activity_log,
    bom_lines,
    bom_versions,
    customers,
    projects,
    users,
)

settings = get_settings()

app = FastAPI(title=settings.app_name, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    """Liveness probe used by Docker Compose and load balancers."""
    return {"status": "ok", "service": settings.app_name}


@app.get("/api/health", tags=["health"])
def api_health() -> dict[str, str]:
    return {"status": "ok"}


api = settings.api_v1_prefix
app.include_router(users.router, prefix=api)
app.include_router(customers.router, prefix=api)
app.include_router(projects.router, prefix=api)
app.include_router(bom_versions.router, prefix=api)
app.include_router(bom_lines.router, prefix=api)
app.include_router(activity_log.router, prefix=api)
