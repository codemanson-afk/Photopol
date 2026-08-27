"""Batch job fan-out + ZIP download (Phase 3)."""

from __future__ import annotations

import io
import logging
import uuid
import zipfile
from datetime import datetime, timezone
from typing import Any, List, Optional

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import Image, ImageVersion, JobStatus, ProcessingJob, User
from app.services.jobs import JobService
from app.services.storage import get_storage
from app.services.tool_registry import PLAN_BATCH_SIZE, effective_plan
from app.models import Subscription

logger = logging.getLogger(__name__)


class BatchService:
    def __init__(self, db: Session):
        self.db = db
        self.jobs = JobService(db)
        self.storage = get_storage()

    def _plan(self, user: User) -> str:
        sub = (
            self.db.query(Subscription)
            .filter(Subscription.user_id == user.id)
            .order_by(Subscription.created_at.desc())
            .first()
        )
        status = sub.status if sub else None
        plan = sub.plan_id if sub and sub.status in ("active", "trialing") else getattr(user, "plan_id", "free")
        return effective_plan(plan, status)

    def create_batch(
        self,
        user: User,
        *,
        project_id: uuid.UUID,
        image_ids: List[uuid.UUID],
        tool: str,
        model_id: Optional[str] = None,
        params: Optional[dict] = None,
        free: bool = False,
    ) -> dict[str, Any]:
        if not image_ids:
            raise AppError("Select at least one image", code="empty_batch", status_code=400)
        plan = self._plan(user)
        limit = PLAN_BATCH_SIZE.get(plan, 1)
        if len(image_ids) > limit:
            raise AppError(
                f"Plan allows up to {limit} images per batch",
                code="batch_limit",
                status_code=403,
            )

        batch_id = uuid.uuid4()
        children: List[ProcessingJob] = []
        params = dict(params or {})
        mode = (self.jobs.settings.JOB_EXECUTION_MODE or "inline").lower()

        for image_id in image_ids:
            job = self.jobs.create_job(
                user,
                project_id=project_id,
                image_id=image_id,
                tool=tool,
                model_id=model_id,
                params=params,
                idempotency_key=f"batch-{batch_id}-{image_id}",
                free=free,
                batch_id=batch_id,
                skip_concurrency=True,
                defer_execute=True,
            )
            children.append(job)

        # Execute / enqueue after all reserved
        for job in children:
            if mode == "queue":
                try:
                    self.jobs._enqueue_arq(job.id)
                except Exception:
                    logger.exception("Batch enqueue failed; inline %s", job.id)
                    self.jobs.execute_job(job.id)
            else:
                self.jobs.execute_job(job.id)

        return self.get_batch(user, batch_id)

    def get_batch(self, user: User, batch_id: uuid.UUID) -> dict[str, Any]:
        jobs = (
            self.db.query(ProcessingJob)
            .filter(ProcessingJob.batch_id == batch_id, ProcessingJob.user_id == user.id)
            .order_by(ProcessingJob.created_at.asc())
            .all()
        )
        if not jobs:
            raise AppError("Batch not found", code="not_found", status_code=404)

        def status_rank(s: JobStatus) -> int:
            return {
                JobStatus.COMPLETED: 3,
                JobStatus.FAILED: 2,
                JobStatus.CANCELLED: 2,
                JobStatus.PROCESSING: 1,
                JobStatus.QUEUED: 0,
                JobStatus.PENDING: 0,
            }.get(s, 0)

        completed = sum(1 for j in jobs if j.status == JobStatus.COMPLETED)
        failed = sum(1 for j in jobs if j.status in (JobStatus.FAILED, JobStatus.CANCELLED))
        total = len(jobs)
        if completed == total:
            overall = "COMPLETED"
        elif completed + failed == total and failed:
            overall = "FAILED" if completed == 0 else "PARTIAL"
        elif any(j.status == JobStatus.PROCESSING for j in jobs):
            overall = "PROCESSING"
        else:
            overall = "QUEUED"

        return {
            "id": str(batch_id),
            "status": overall,
            "total": total,
            "completed": completed,
            "failed": failed,
            "jobs": [
                {
                    "id": str(j.id),
                    "image_id": str(j.image_id),
                    "status": j.status.value,
                    "progress": j.progress or 0,
                    "result_version_id": str(j.result_version_id) if j.result_version_id else None,
                    "error_message": j.error_message,
                    "credit_cost": j.credit_cost,
                }
                for j in jobs
            ],
        }

    def build_zip(self, user: User, batch_id: uuid.UUID) -> tuple[bytes, str]:
        info = self.get_batch(user, batch_id)
        buf = io.BytesIO()
        count = 0
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for item in info["jobs"]:
                if not item["result_version_id"]:
                    continue
                vid = uuid.UUID(item["result_version_id"])
                version = self.db.query(ImageVersion).filter(ImageVersion.id == vid).first()
                if not version:
                    continue
                data = self.storage.download_bytes(version.storage_key)
                ext = "png" if "png" in (version.content_type or "") else "jpg"
                name = f"{item['image_id'][:8]}_{version.operation or 'out'}.{ext}"
                zf.writestr(name, data)
                count += 1
        if count == 0:
            raise AppError("No completed results to download", code="empty_zip", status_code=400)
        filename = f"photopol-batch-{str(batch_id)[:8]}.zip"
        return buf.getvalue(), filename
