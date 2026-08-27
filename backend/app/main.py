import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api import api_router
from app.core.config import get_settings
from app.core.database import Base, engine
from app.core.errors import AppError, error_response
from app.core.rate_limit import AIRateLimitMiddleware
from app.services.storage import get_storage
import app.models  # noqa: F401

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("photopol")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info("Starting %s (%s)", settings.APP_NAME, settings.ENVIRONMENT)
    if settings.DATABASE_URL.startswith("sqlite"):
        Base.metadata.create_all(bind=engine)
        try:
            with engine.begin() as conn:
                cols = [r[1] for r in conn.exec_driver_sql("PRAGMA table_info(users)").fetchall()]
                if "is_guest" not in cols:
                    conn.exec_driver_sql(
                        "ALTER TABLE users ADD COLUMN is_guest BOOLEAN NOT NULL DEFAULT 0"
                    )
                if "reserved_credits" not in cols:
                    conn.exec_driver_sql(
                        "ALTER TABLE users ADD COLUMN reserved_credits INTEGER NOT NULL DEFAULT 0"
                    )
                if "plan_id" not in cols:
                    conn.exec_driver_sql(
                        "ALTER TABLE users ADD COLUMN plan_id VARCHAR(50) NOT NULL DEFAULT 'free'"
                    )
                if "stripe_customer_id" not in cols:
                    conn.exec_driver_sql(
                        "ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255)"
                    )
                job_cols = [
                    r[1] for r in conn.exec_driver_sql("PRAGMA table_info(processing_jobs)").fetchall()
                ]
                alters = [
                    ("tool", "VARCHAR(50)"),
                    ("model_id", "VARCHAR(100)"),
                    ("progress", "INTEGER NOT NULL DEFAULT 0"),
                    ("priority", "INTEGER NOT NULL DEFAULT 0"),
                    ("credits_held", "BOOLEAN NOT NULL DEFAULT 0"),
                    ("error_code", "VARCHAR(64)"),
                    ("started_at", "DATETIME"),
                    ("batch_id", "CHAR(36)"),
                ]
                for name, typ in alters:
                    if name not in job_cols:
                        conn.exec_driver_sql(
                            f"ALTER TABLE processing_jobs ADD COLUMN {name} {typ}"
                        )
                tables = [
                    r[0]
                    for r in conn.exec_driver_sql(
                        "SELECT name FROM sqlite_master WHERE type='table'"
                    ).fetchall()
                ]
                if "subscriptions" not in tables:
                    conn.exec_driver_sql(
                        """
                        CREATE TABLE subscriptions (
                            id CHAR(36) PRIMARY KEY,
                            user_id CHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            stripe_customer_id VARCHAR(255),
                            stripe_subscription_id VARCHAR(255) UNIQUE,
                            plan_id VARCHAR(50) NOT NULL DEFAULT 'free',
                            status VARCHAR(50) NOT NULL DEFAULT 'inactive',
                            current_period_end DATETIME,
                            monthly_credit_allowance INTEGER NOT NULL DEFAULT 0,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                        )
                        """
                    )
        except Exception:
            logger.warning("Could not ensure phase2 sqlite columns")
        logger.info("SQLite tables ensured")
    try:
        get_storage().ensure_bucket()
    except Exception:
        logger.warning("Could not ensure storage on startup")
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.APP_NAME,
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url=None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(AIRateLimitMiddleware)

    @app.exception_handler(AppError)
    async def app_error_handler(_: Request, exc: AppError):
        return error_response(exc)

    @app.exception_handler(Exception)
    async def unhandled_error_handler(_: Request, exc: Exception):
        logger.exception("Unhandled error")
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "internal_error", "message": "Something went wrong"}},
        )

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

    app.include_router(api_router, prefix="/api")

    @app.get("/api/_build")
    def api_build():
        from app.api import API_ROUTER_BUILD

        return {"build": API_ROUTER_BUILD, "has_guest": True}

    if settings.STORAGE_BACKEND.lower() == "local":
        media_root = Path(settings.LOCAL_STORAGE_DIR).resolve()
        media_root.mkdir(parents=True, exist_ok=True)
        app.mount("/media", StaticFiles(directory=str(media_root)), name="media")

    return app


app = create_app()
