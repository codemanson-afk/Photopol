import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.models import (
    Image,
    ImageVersion,
    ImageVersionKind,
    JobStatus,
    JobType,
    ProcessingJob,
    Project,
    User,
)
from app.services.ai import get_ai_service
from app.services.credits import CreditService
from app.services.image_ops import convert_format, crop_image, resize_image
from app.services.storage import get_storage, read_image_meta, sanitize_filename

logger = logging.getLogger(__name__)


class ProcessingService:
    def __init__(self, db: Session):
        self.db = db
        self.storage = get_storage()
        self.credits = CreditService(db)
        self.settings = get_settings()

    def get_owned_project(self, user: User, project_id: uuid.UUID) -> Project:
        project = (
            self.db.query(Project)
            .filter(Project.id == project_id, Project.user_id == user.id)
            .first()
        )
        if not project:
            raise AppError("Project not found", code="not_found", status_code=404)
        return project

    def get_owned_image(self, user: User, image_id: uuid.UUID, project_id: Optional[uuid.UUID] = None) -> Image:
        q = self.db.query(Image).filter(Image.id == image_id, Image.user_id == user.id)
        if project_id:
            q = q.filter(Image.project_id == project_id)
        image = q.first()
        if not image:
            raise AppError("Image not found", code="not_found", status_code=404)
        return image

    def upload_image(
        self,
        user: User,
        project: Project,
        *,
        filename: str,
        content_type: str,
        data: bytes,
    ) -> Image:
        if content_type not in self.settings.allowed_image_types_list:
            raise AppError("Unsupported file type", code="invalid_upload", status_code=400)
        if len(data) > self.settings.MAX_UPLOAD_BYTES:
            raise AppError("File too large", code="file_too_large", status_code=400)
        if len(data) == 0:
            raise AppError("Empty file", code="invalid_upload", status_code=400)

        width, height, _ = read_image_meta(data)
        safe_name = sanitize_filename(filename)
        key = self.storage.build_key(user.id, project.id, safe_name)
        self.storage.upload_bytes(key, data, content_type)

        image = Image(
            id=uuid.uuid4(),
            project_id=project.id,
            user_id=user.id,
            original_filename=safe_name,
            content_type=content_type,
            storage_key=key,
            width=width,
            height=height,
            byte_size=len(data),
        )
        version = ImageVersion(
            id=uuid.uuid4(),
            image_id=image.id,
            kind=ImageVersionKind.ORIGINAL,
            operation=None,
            storage_key=key,
            content_type=content_type,
            width=width,
            height=height,
            byte_size=len(data),
        )
        self.db.add(image)
        self.db.flush()
        version.image_id = image.id
        self.db.add(version)
        self.db.commit()
        self.db.refresh(image)
        return image

    def replace_upload(
        self,
        user: User,
        project: Project,
        *,
        filename: str,
        content_type: str,
        data: bytes,
    ) -> Image:
        """Clear existing images on the project, then upload the new original."""
        existing = (
            self.db.query(Image)
            .filter(Image.project_id == project.id, Image.user_id == user.id)
            .all()
        )
        for img in existing:
            self.db.delete(img)
        if existing:
            self.db.flush()
        return self.upload_image(
            user,
            project,
            filename=filename,
            content_type=content_type,
            data=data,
        )

    def _source_bytes(self, image: Image, version_id: Optional[uuid.UUID] = None) -> tuple[bytes, str, ImageVersion]:
        if version_id:
            version = (
                self.db.query(ImageVersion)
                .filter(ImageVersion.id == version_id, ImageVersion.image_id == image.id)
                .first()
            )
            if not version:
                raise AppError("Version not found", code="not_found", status_code=404)
        else:
            # Prefer latest processed, else original
            version = (
                self.db.query(ImageVersion)
                .filter(ImageVersion.image_id == image.id)
                .order_by(ImageVersion.created_at.desc())
                .first()
            )
            if not version:
                raise AppError("No image versions", code="not_found", status_code=404)
        data = self.storage.download_bytes(version.storage_key)
        return data, version.content_type, version

    def remove_background(
        self,
        user: User,
        project_id: uuid.UUID,
        image_id: uuid.UUID,
        idempotency_key: Optional[str] = None,
        *,
        free: bool = False,
    ) -> ProcessingJob:
        project = self.get_owned_project(user, project_id)
        image = self.get_owned_image(user, image_id, project.id)
        cost = 0 if free else self.settings.CREDIT_COST_BACKGROUND_REMOVAL
        if not free:
            self.credits.ensure_balance(user, cost)

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

        job = ProcessingJob(
            id=uuid.uuid4(),
            user_id=user.id,
            project_id=project.id,
            image_id=image.id,
            job_type=JobType.BACKGROUND_REMOVAL,
            status=JobStatus.PROCESSING,
            credit_cost=cost,
            provider="ai",
            idempotency_key=idempotency_key or f"bg-{image.id}-{uuid.uuid4().hex[:8]}",
        )
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)

        try:
            source_bytes, content_type, _ = self._source_bytes(image)
            ai = get_ai_service()
            result = ai.remove_background(source_bytes, content_type)
            job.provider = result.provider or "ai"

            width, height, _ = read_image_meta(result.image_bytes)
            key = self.storage.build_key(user.id, project.id, f"bg_removed_{image.id}.png")
            self.storage.upload_bytes(key, result.image_bytes, result.content_type)

            version = ImageVersion(
                id=uuid.uuid4(),
                image_id=image.id,
                kind=ImageVersionKind.PROCESSED,
                operation="background_removal",
                storage_key=key,
                content_type=result.content_type,
                width=width,
                height=height,
                byte_size=len(result.image_bytes),
                meta={
                    "provider": result.provider,
                    "model": (
                        "remove.bg"
                        if result.provider == "removebg"
                        else (
                            self.settings.REPLICATE_BG_REMOVAL_MODEL
                            if result.provider == "replicate"
                            else "u2netp"
                        )
                    ),
                },
            )
            self.db.add(version)
            self.db.flush()

            if not free and cost > 0:
                self.credits.deduct(
                    user,
                    cost,
                    operation="background_removal",
                    reference_id=str(job.id),
                )
                job.credits_deducted = True
            job.status = JobStatus.COMPLETED
            job.result_version_id = version.id
            job.provider_job_id = result.provider_job_id
            job.completed_at = datetime.now(timezone.utc)
            self.db.commit()
            self.db.refresh(job)
            return job
        except Exception as exc:
            logger.exception("Background removal job failed")
            self.db.rollback()
            job = self.db.query(ProcessingJob).filter(ProcessingJob.id == job.id).first()
            if job:
                job.status = JobStatus.FAILED
                job.error_message = "AI processing failed"
                job.completed_at = datetime.now(timezone.utc)
                self.db.commit()
                self.db.refresh(job)
            if isinstance(exc, AppError):
                raise
            raise AppError("AI processing failed", code="ai_failed", status_code=502) from exc

    def resize(
        self,
        user: User,
        project_id: uuid.UUID,
        image_id: uuid.UUID,
        *,
        width: Optional[int] = None,
        height: Optional[int] = None,
        aspect_ratio: Optional[str] = None,
        version_id: Optional[uuid.UUID] = None,
        free: bool = False,
    ) -> ProcessingJob:
        project = self.get_owned_project(user, project_id)
        image = self.get_owned_image(user, image_id, project.id)
        cost = 0 if free else self.settings.CREDIT_COST_RESIZE
        if not free:
            self.credits.ensure_balance(user, cost)

        job = ProcessingJob(
            id=uuid.uuid4(),
            user_id=user.id,
            project_id=project.id,
            image_id=image.id,
            job_type=JobType.RESIZE,
            status=JobStatus.PROCESSING,
            credit_cost=cost,
            provider="local",
            params={"width": width, "height": height, "aspect_ratio": aspect_ratio},
            idempotency_key=f"resize-{image.id}-{uuid.uuid4().hex}",
        )
        self.db.add(job)
        self.db.commit()

        try:
            source_bytes, _, _ = self._source_bytes(image, version_id)
            out_bytes, content_type, out_w, out_h = resize_image(
                source_bytes, width=width, height=height, aspect_ratio=aspect_ratio
            )
            ext = "png" if content_type == "image/png" else "jpg"
            key = self.storage.build_key(user.id, project.id, f"resized_{image.id}.{ext}")
            self.storage.upload_bytes(key, out_bytes, content_type)
            version = ImageVersion(
                id=uuid.uuid4(),
                image_id=image.id,
                kind=ImageVersionKind.PROCESSED,
                operation="resize",
                storage_key=key,
                content_type=content_type,
                width=out_w,
                height=out_h,
                byte_size=len(out_bytes),
                meta={"width": out_w, "height": out_h, "aspect_ratio": aspect_ratio},
            )
            self.db.add(version)
            self.db.flush()
            if not free and cost > 0:
                self.credits.deduct(user, cost, operation="resize", reference_id=str(job.id))
                job.credits_deducted = True
            job.status = JobStatus.COMPLETED
            job.result_version_id = version.id
            job.completed_at = datetime.now(timezone.utc)
            self.db.commit()
            self.db.refresh(job)
            return job
        except Exception as exc:
            logger.exception("Resize failed")
            self.db.rollback()
            job = self.db.query(ProcessingJob).filter(ProcessingJob.id == job.id).first()
            if job:
                job.status = JobStatus.FAILED
                job.error_message = str(exc) if isinstance(exc, AppError) else "Resize failed"
                job.completed_at = datetime.now(timezone.utc)
                self.db.commit()
                self.db.refresh(job)
            if isinstance(exc, AppError):
                raise
            raise AppError("Resize failed", code="resize_failed", status_code=500) from exc

    def crop(
        self,
        user: User,
        project_id: uuid.UUID,
        image_id: uuid.UUID,
        *,
        x: int,
        y: int,
        width: int,
        height: int,
        version_id: Optional[uuid.UUID] = None,
        free: bool = False,
    ) -> ProcessingJob:
        project = self.get_owned_project(user, project_id)
        image = self.get_owned_image(user, image_id, project.id)
        cost = 0 if free else self.settings.CREDIT_COST_CROP
        if not free:
            self.credits.ensure_balance(user, cost)

        job = ProcessingJob(
            id=uuid.uuid4(),
            user_id=user.id,
            project_id=project.id,
            image_id=image.id,
            job_type=JobType.CROP,
            status=JobStatus.PROCESSING,
            credit_cost=cost,
            provider="local",
            params={"x": x, "y": y, "width": width, "height": height},
            idempotency_key=f"crop-{image.id}-{uuid.uuid4().hex}",
        )
        self.db.add(job)
        self.db.commit()

        try:
            source_bytes, _, _ = self._source_bytes(image, version_id)
            out_bytes, content_type, out_w, out_h = crop_image(
                source_bytes, x=x, y=y, width=width, height=height
            )
            ext = "png" if content_type == "image/png" else "jpg"
            key = self.storage.build_key(user.id, project.id, f"cropped_{image.id}.{ext}")
            self.storage.upload_bytes(key, out_bytes, content_type)
            version = ImageVersion(
                id=uuid.uuid4(),
                image_id=image.id,
                kind=ImageVersionKind.PROCESSED,
                operation="crop",
                storage_key=key,
                content_type=content_type,
                width=out_w,
                height=out_h,
                byte_size=len(out_bytes),
            )
            self.db.add(version)
            self.db.flush()
            if not free and cost > 0:
                self.credits.deduct(user, cost, operation="crop", reference_id=str(job.id))
                job.credits_deducted = True
            job.status = JobStatus.COMPLETED
            job.result_version_id = version.id
            job.completed_at = datetime.now(timezone.utc)
            self.db.commit()
            self.db.refresh(job)
            return job
        except Exception as exc:
            logger.exception("Crop failed")
            self.db.rollback()
            job = self.db.query(ProcessingJob).filter(ProcessingJob.id == job.id).first()
            if job:
                job.status = JobStatus.FAILED
                job.error_message = str(exc) if isinstance(exc, AppError) else "Crop failed"
                job.completed_at = datetime.now(timezone.utc)
                self.db.commit()
                self.db.refresh(job)
            if isinstance(exc, AppError):
                raise
            raise AppError("Crop failed", code="crop_failed", status_code=500) from exc

    def download_version(
        self,
        user: User,
        version_id: uuid.UUID,
        fmt: Optional[str] = None,
    ) -> tuple[bytes, str, str]:
        version = (
            self.db.query(ImageVersion)
            .join(Image)
            .filter(ImageVersion.id == version_id, Image.user_id == user.id)
            .first()
        )
        if not version:
            raise AppError("Version not found", code="not_found", status_code=404)
        data = self.storage.download_bytes(version.storage_key)
        content_type = version.content_type
        filename = f"photopol_{version.id}"
        if fmt:
            data, content_type = convert_format(data, fmt)
            filename = f"{filename}.{fmt.lower()}"
        else:
            ext = "png" if "png" in content_type else "jpg"
            filename = f"{filename}.{ext}"
        return data, content_type, filename
