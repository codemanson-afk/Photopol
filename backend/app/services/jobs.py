"""Enqueue + execute processing jobs (Phase 2)."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.models import (
    Image,
    ImageVersion,
    ImageVersionKind,
    JobStatus,
    ProcessingJob,
    Subscription,
    User,
)
from app.services.ai import get_ai_service
from app.services.credits import CreditService
from app.services.image_ops import (
    composite_on_color,
    crop_image,
    enhance_manual,
    fit_resize,
    geometry_transform,
    resize_image,
)
from app.services.storage import get_storage, read_image_meta
from app.services.tool_registry import (
    PLAN_MAX_CONCURRENT,
    PLAN_PRIORITY,
    assert_plan_allows,
    effective_plan,
    get_model,
    get_tool,
)
from app.services.transforms import (
    run_ai_edit,
    run_bg_replace,
    run_enhance,
    run_object_remove,
    run_upscale,
)

logger = logging.getLogger(__name__)


class JobService:
    def __init__(self, db: Session):
        self.db = db
        self.storage = get_storage()
        self.credits = CreditService(db)
        self.settings = get_settings()

    def _user_plan(self, user: User) -> str:
        sub = (
            self.db.query(Subscription)
            .filter(Subscription.user_id == user.id)
            .order_by(Subscription.created_at.desc())
            .first()
        )
        status = sub.status if sub else None
        plan = sub.plan_id if sub and sub.status in ("active", "trialing") else getattr(user, "plan_id", "free")
        return effective_plan(plan, status)

    def _source_bytes(
        self, image: Image, version_id: Optional[uuid.UUID] = None
    ) -> tuple[bytes, str, ImageVersion]:
        if version_id:
            version = (
                self.db.query(ImageVersion)
                .filter(ImageVersion.id == version_id, ImageVersion.image_id == image.id)
                .first()
            )
            if not version:
                raise AppError("Version not found", code="not_found", status_code=404)
        else:
            version = (
                self.db.query(ImageVersion)
                .filter(ImageVersion.image_id == image.id)
                .order_by(ImageVersion.created_at.desc())
                .first()
            )
            if not version:
                raise AppError("No image versions", code="not_found", status_code=404)
        return self.storage.download_bytes(version.storage_key), version.content_type, version

    def create_job(
        self,
        user: User,
        *,
        project_id: uuid.UUID,
        image_id: uuid.UUID,
        tool: str,
        model_id: Optional[str] = None,
        params: Optional[dict] = None,
        version_id: Optional[uuid.UUID] = None,
        idempotency_key: Optional[str] = None,
        free: bool = False,
        batch_id: Optional[uuid.UUID] = None,
        skip_concurrency: bool = False,
        defer_execute: bool = False,
    ) -> ProcessingJob:
        from app.services.processing import ProcessingService

        proc = ProcessingService(self.db)
        project = proc.get_owned_project(user, project_id)
        image = proc.get_owned_image(user, image_id, project.id)

        tool_def = get_tool(tool)
        model = get_model(tool, model_id)
        plan = self._user_plan(user)
        if not free:
            assert_plan_allows(plan, model)

        cost = 0 if free else model.credits
        params = dict(params or {})
        if version_id:
            params["version_id"] = str(version_id)
        if model.default_params:
            for k, v in model.default_params.items():
                params.setdefault(k, v)

        if tool == "object_remove" and not params.get("mask_storage_key"):
            raise AppError("mask_storage_key required", code="mask_required", status_code=400)
        if tool == "ai_edit" and not str(params.get("prompt") or "").strip():
            raise AppError("Describe what you want to change.", code="prompt_required", status_code=400)

        if idempotency_key:
            existing = (
                self.db.query(ProcessingJob)
                .filter(ProcessingJob.idempotency_key == idempotency_key)
                .first()
            )
            if existing:
                if existing.user_id != user.id:
                    raise AppError("Invalid idempotency key", code="forbidden", status_code=403)
                return existing

        # Concurrent jobs
        if not skip_concurrency:
            active = (
                self.db.query(ProcessingJob)
                .filter(
                    ProcessingJob.user_id == user.id,
                    ProcessingJob.status.in_(
                        [JobStatus.QUEUED, JobStatus.PROCESSING, JobStatus.PENDING]
                    ),
                )
                .count()
            )
            max_c = PLAN_MAX_CONCURRENT.get(plan, 1)
            if active >= max_c:
                raise AppError(
                    "Too many jobs in progress",
                    code="concurrency_limit",
                    status_code=429,
                )

        if not free and cost > 0:
            self.credits.ensure_balance(user, cost)
            self.credits.reserve(user, cost)

        job = ProcessingJob(
            id=uuid.uuid4(),
            user_id=user.id,
            project_id=project.id,
            image_id=image.id,
            job_type=tool_def.job_type,
            tool=tool,
            model_id=model.id,
            status=JobStatus.QUEUED,
            credit_cost=cost,
            credits_held=not free and cost > 0,
            provider=model.provider,
            priority=PLAN_PRIORITY.get(plan, 0),
            progress=0,
            params=params,
            batch_id=batch_id,
            idempotency_key=idempotency_key or f"{tool}-{image.id}-{uuid.uuid4().hex[:10]}",
        )
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)

        if defer_execute:
            return job

        mode = (self.settings.JOB_EXECUTION_MODE or "inline").lower()
        if mode == "queue":
            try:
                self._enqueue_arq(job.id)
            except Exception:
                logger.exception("Queue enqueue failed; running inline")
                return self.execute_job(job.id)
        else:
            return self.execute_job(job.id)
        return job

    def _enqueue_arq(self, job_id: uuid.UUID) -> None:
        import asyncio

        async def _push():
            from arq import create_pool
            from arq.connections import RedisSettings

            redis = await create_pool(RedisSettings.from_dsn(self.settings.REDIS_URL))
            try:
                await redis.enqueue_job("process_job", str(job_id), _queue_name="photopol")
            finally:
                await redis.close()

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # sync context inside FastAPI — use new loop in thread
                import concurrent.futures

                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                    pool.submit(lambda: asyncio.run(_push())).result(timeout=10)
            else:
                loop.run_until_complete(_push())
        except RuntimeError:
            asyncio.run(_push())

    def get_owned_job(self, user: User, job_id: uuid.UUID) -> ProcessingJob:
        job = (
            self.db.query(ProcessingJob)
            .filter(ProcessingJob.id == job_id, ProcessingJob.user_id == user.id)
            .first()
        )
        if not job:
            raise AppError("Job not found", code="not_found", status_code=404)
        return job

    def cancel_job(self, user: User, job_id: uuid.UUID) -> ProcessingJob:
        job = self.get_owned_job(user, job_id)
        if job.status != JobStatus.QUEUED:
            raise AppError("Only queued jobs can be cancelled", code="invalid_state", status_code=400)
        if job.credits_held and job.credit_cost > 0:
            u = self.db.query(User).filter(User.id == user.id).one()
            self.credits.release_reserve(u, job.credit_cost)
            job.credits_held = False
        job.status = JobStatus.CANCELLED
        job.completed_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(job)
        return job

    def execute_job(self, job_id: uuid.UUID) -> ProcessingJob:
        job = self.db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
        if not job:
            raise AppError("Job not found", code="not_found", status_code=404)
        if job.status in (JobStatus.COMPLETED, JobStatus.CANCELLED):
            return job

        user = self.db.query(User).filter(User.id == job.user_id).one()
        image = self.db.query(Image).filter(Image.id == job.image_id).one()
        tool = job.tool or _tool_from_job_type(job.job_type.value)
        params: dict[str, Any] = dict(job.params or {})
        version_id = None
        if params.get("version_id"):
            try:
                version_id = uuid.UUID(str(params["version_id"]))
            except Exception:
                version_id = None

        job.status = JobStatus.PROCESSING
        job.started_at = datetime.now(timezone.utc)
        job.progress = 10
        self.db.commit()

        try:
            source_bytes, content_type, _ = self._source_bytes(image, version_id)
            job.progress = 30
            self.db.commit()

            result_bytes: bytes
            result_ct: str
            provider = job.provider or "local"
            meta: dict = {}

            if tool == "remove_bg":
                ai = get_ai_service()
                # honor model provider hint
                if job.model_id == "bg-fast":
                    from app.services.ai import LocalRembgProvider

                    out = LocalRembgProvider().remove_background(source_bytes, content_type)
                elif job.model_id == "bg-pro":
                    from app.services.ai import RemoveBgProvider

                    out = RemoveBgProvider().remove_background(source_bytes, content_type)
                else:
                    out = ai.remove_background(source_bytes, content_type)
                result_bytes, result_ct = out.image_bytes, out.content_type
                provider = out.provider
                meta = {"provider": provider}
            elif tool == "resize":
                fit = params.get("fit")
                if params.get("width") and params.get("height") and fit:
                    result_bytes, result_ct, out_w, out_h = fit_resize(
                        source_bytes,
                        width=int(params["width"]),
                        height=int(params["height"]),
                        fit=str(fit),
                    )
                else:
                    result_bytes, result_ct, out_w, out_h = resize_image(
                        source_bytes,
                        width=params.get("width"),
                        height=params.get("height"),
                        aspect_ratio=params.get("aspect_ratio"),
                    )
                meta = {"width": out_w, "height": out_h, "fit": fit}
                provider = "local"
            elif tool == "crop":
                # Optional geometry before crop
                if params.get("rotate") or params.get("flip_h") or params.get("flip_v"):
                    source_bytes, content_type, _, _ = geometry_transform(
                        source_bytes,
                        rotate=float(params.get("rotate") or 0),
                        flip_h=bool(params.get("flip_h")),
                        flip_v=bool(params.get("flip_v")),
                    )
                result_bytes, result_ct, out_w, out_h = crop_image(
                    source_bytes,
                    x=int(params["x"]),
                    y=int(params["y"]),
                    width=int(params["width"]),
                    height=int(params["height"]),
                )
                meta = {"width": out_w, "height": out_h}
                provider = "local"
            elif tool == "upscale":
                scale = int(params.get("scale") or 2)
                model = get_model("upscale", job.model_id)
                w, h, _ = read_image_meta(source_bytes)
                max_dim = self.settings.MAX_IMAGE_DIMENSION
                longest = max(w, h)
                if longest * scale > max_dim:
                    # Clamp scale so result stays within limit; skip if already at/near max.
                    allowed = max(1, max_dim // max(longest, 1))
                    if allowed < 2:
                        result_bytes, result_ct = source_bytes, content_type
                        provider = "skipped_upscale"
                        meta = {
                            "scale": 1,
                            "skipped": True,
                            "reason": "dimension_limit",
                            "width": w,
                            "height": h,
                        }
                    else:
                        scale = min(scale, allowed)
                        out = run_upscale(
                            source_bytes,
                            content_type,
                            scale=scale,
                            model=model.replicate_model or self.settings.REPLICATE_UPSCALE_MODEL,
                        )
                        result_bytes, result_ct = out.image_bytes, out.content_type
                        provider = out.provider
                        meta = {**(out.meta or {}), "scale": scale, "clamped": True}
                else:
                    out = run_upscale(
                        source_bytes,
                        content_type,
                        scale=scale,
                        model=model.replicate_model or self.settings.REPLICATE_UPSCALE_MODEL,
                    )
                    result_bytes, result_ct = out.image_bytes, out.content_type
                    provider = out.provider
                    meta = out.meta or {"scale": scale}
            elif tool == "object_remove":
                mask_key = params.get("mask_storage_key")
                if not mask_key:
                    raise AppError("mask_storage_key required", code="mask_required", status_code=400)
                mask_bytes = self.storage.download_bytes(mask_key)
                model = get_model("object_remove", job.model_id)
                out = run_object_remove(
                    source_bytes,
                    content_type,
                    mask_bytes,
                    model=model.replicate_model or self.settings.REPLICATE_OBJECT_REMOVE_MODEL,
                )
                result_bytes, result_ct = out.image_bytes, out.content_type
                provider = out.provider
                meta = out.meta or {}
            elif tool == "enhance":
                if params.get("manual"):
                    result_bytes, result_ct, out_w, out_h = enhance_manual(
                        source_bytes,
                        brightness=float(params.get("brightness") or 0),
                        contrast=float(params.get("contrast") or 0),
                        saturation=float(params.get("saturation") or 0),
                        sharpen=float(params.get("sharpen") or 0),
                        warmth=float(params.get("warmth") or 0),
                    )
                    meta = {"width": out_w, "height": out_h, "manual": True}
                    provider = "local_enhance_manual"
                else:
                    model = get_model("enhance", job.model_id)
                    out = run_enhance(
                        source_bytes,
                        content_type,
                        model=model.replicate_model or self.settings.REPLICATE_ENHANCE_MODEL,
                    )
                    result_bytes, result_ct = out.image_bytes, out.content_type
                    provider = out.provider
                    meta = out.meta or {}
            elif tool == "bg_replace":
                skip_recut = bool(params.get("skip_recut"))
                if skip_recut:
                    # Source already a cutout PNG
                    result_bytes, result_ct, out_w, out_h = composite_on_color(
                        source_bytes,
                        color=str(params.get("color") or "#FFFFFF"),
                        drop_shadow=bool(params.get("drop_shadow")),
                        subject_scale=float(params.get("subject_scale") or 100),
                        position=str(params.get("position") or "center"),
                    )
                    provider = "local_composite"
                    meta = {"color": params.get("color"), "drop_shadow": params.get("drop_shadow")}
                else:
                    out = run_bg_replace(
                        source_bytes,
                        content_type,
                        color=str(params.get("color") or "#8B5CF6"),
                        prompt=params.get("prompt"),
                        drop_shadow=bool(params.get("drop_shadow")),
                        subject_scale=float(params.get("subject_scale") or 100),
                        position=str(params.get("position") or "center"),
                    )
                    result_bytes, result_ct = out.image_bytes, out.content_type
                    provider = out.provider
                    meta = out.meta or {}
            elif tool == "ai_edit":
                model = get_model("ai_edit", job.model_id)
                out = run_ai_edit(
                    source_bytes,
                    content_type,
                    prompt=str(params.get("prompt") or ""),
                    model=model.replicate_model or self.settings.REPLICATE_AI_EDIT_MODEL,
                )
                result_bytes, result_ct = out.image_bytes, out.content_type
                provider = out.provider
                meta = out.meta or {}
            else:
                raise AppError(f"Unsupported tool {tool}", code="unknown_tool", status_code=400)

            # Optional export encode pass
            if params.get("export_format"):
                from app.services.image_ops import encode_export

                result_bytes, result_ct = encode_export(
                    result_bytes,
                    fmt=str(params.get("export_format")),
                    quality=int(params.get("export_quality") or 92),
                    strip_metadata=bool(params.get("strip_metadata", True)),
                )

            job.progress = 80
            self.db.commit()

            width, height, _ = read_image_meta(result_bytes)
            ext = "png" if "png" in result_ct else "jpg"
            key = self.storage.build_key(user.id, job.project_id, f"{tool}_{image.id}.{ext}")
            self.storage.upload_bytes(key, result_bytes, result_ct)

            version = ImageVersion(
                id=uuid.uuid4(),
                image_id=image.id,
                kind=ImageVersionKind.PROCESSED,
                operation=tool,
                storage_key=key,
                content_type=result_ct,
                width=width,
                height=height,
                byte_size=len(result_bytes),
                meta={**meta, "model_id": job.model_id, "tool": tool, "params": params},
            )
            self.db.add(version)
            self.db.flush()

            if job.credit_cost > 0 and not job.credits_deducted:
                self.credits.deduct(
                    user,
                    job.credit_cost,
                    operation=tool,
                    reference_id=str(job.id),
                    release_hold=job.credit_cost if job.credits_held else 0,
                )
                job.credits_deducted = True
                job.credits_held = False

            job.status = JobStatus.COMPLETED
            job.result_version_id = version.id
            job.provider = provider
            job.progress = 100
            job.completed_at = datetime.now(timezone.utc)
            self.db.commit()
            self.db.refresh(job)
            return job
        except Exception as exc:
            logger.exception("Job %s failed", job_id)
            self.db.rollback()
            job = self.db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
            user = self.db.query(User).filter(User.id == job.user_id).one() if job else None
            if job:
                if job.credits_held and job.credit_cost > 0 and user:
                    self.credits.release_reserve(user, job.credit_cost)
                    job.credits_held = False
                job.status = JobStatus.FAILED
                job.error_code = getattr(exc, "code", None) or "job_failed"
                job.error_message = (
                    str(exc.message) if isinstance(exc, AppError) else "Processing failed"
                )
                if isinstance(exc, AppError):
                    job.error_message = exc.message
                job.completed_at = datetime.now(timezone.utc)
                job.progress = 100
                self.db.commit()
                self.db.refresh(job)
            if isinstance(exc, AppError):
                # For inline mode, surface error to client
                if (self.settings.JOB_EXECUTION_MODE or "inline").lower() == "inline":
                    raise
            return job  # type: ignore


def _tool_from_job_type(jt: str) -> str:
    return {
        "BACKGROUND_REMOVAL": "remove_bg",
        "RESIZE": "resize",
        "CROP": "crop",
        "OBJECT_REMOVE": "object_remove",
        "UPSCALE": "upscale",
        "BG_REPLACE": "bg_replace",
        "ENHANCE": "enhance",
    }.get(jt, jt.lower())
