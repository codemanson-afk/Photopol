"""Arq worker for Photopol jobs."""

from __future__ import annotations

import logging

from arq.connections import RedisSettings

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.services.jobs import JobService

logger = logging.getLogger("photopol.worker")


async def process_job(ctx, job_id: str) -> str:
    db = SessionLocal()
    try:
        JobService(db).execute_job(__import__("uuid").UUID(job_id))
        return f"ok:{job_id}"
    except Exception:
        logger.exception("Worker failed job %s", job_id)
        raise
    finally:
        db.close()


class WorkerSettings:
    functions = [process_job]
    redis_settings = RedisSettings.from_dsn(get_settings().REDIS_URL)
    queue_name = "photopol"
    max_jobs = 4
    job_timeout = 600
