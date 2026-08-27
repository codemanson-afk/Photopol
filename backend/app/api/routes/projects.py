from typing import Optional
from uuid import UUID

from fastapi import APIRouter, File, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import joinedload

from app.api.deps import CurrentActor, CurrentUser, DbSession
from app.core.config import get_settings
from app.core.errors import AppError
from app.models import Image, JobStatus, ProcessingJob, Project
from app.schemas import (
    BackgroundRemovalRequest,
    CropRequest,
    ImageOut,
    ImageVersionOut,
    JobOut,
    MaskUploadOut,
    ProjectCreate,
    ProjectDetail,
    ProjectOut,
    ResizeRequest,
)
from app.services.processing import ProcessingService
from app.services.storage import get_storage

router = APIRouter()


def _guess_image_type(filename: Optional[str], data: bytes) -> str:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    name = (filename or "").lower()
    if name.endswith((".jpg", ".jpeg")):
        return "image/jpeg"
    if name.endswith(".png"):
        return "image/png"
    if name.endswith(".webp"):
        return "image/webp"
    return "application/octet-stream"


def _image_out(image: Image) -> ImageOut:
    storage = get_storage()
    versions = [
        ImageVersionOut(
            id=v.id,
            kind=v.kind.value,
            operation=v.operation,
            content_type=v.content_type,
            width=v.width,
            height=v.height,
            byte_size=v.byte_size,
            url=storage.public_url(v.storage_key),
            created_at=v.created_at,
        )
        for v in sorted(image.versions, key=lambda x: x.created_at)
    ]
    return ImageOut(
        id=image.id,
        project_id=image.project_id,
        original_filename=image.original_filename,
        content_type=image.content_type,
        width=image.width,
        height=image.height,
        byte_size=image.byte_size,
        url=storage.public_url(image.storage_key),
        created_at=image.created_at,
        versions=versions,
    )


def _job_out(job: ProcessingJob) -> JobOut:
    return JobOut(
        id=job.id,
        job_type=job.job_type.value,
        tool=getattr(job, "tool", None),
        model_id=getattr(job, "model_id", None),
        status=job.status.value,
        credit_cost=job.credit_cost,
        credits_deducted=job.credits_deducted,
        progress=getattr(job, "progress", 0) or 0,
        error_message=job.error_message,
        error_code=getattr(job, "error_code", None),
        result_version_id=job.result_version_id,
        created_at=job.created_at,
        completed_at=job.completed_at,
    )


@router.get("", response_model=list[ProjectOut])
def list_projects(user: CurrentUser, db: DbSession):
    return (
        db.query(Project)
        .filter(Project.user_id == user.id)
        .order_by(Project.updated_at.desc())
        .all()
    )


@router.post("", response_model=ProjectOut)
def create_project(body: ProjectCreate, actor: CurrentActor, db: DbSession):
    """Always create a new project. Guests may own multiple projects while limits are off."""
    user = actor.user
    project = Project(
        name=body.name.strip(),
        description=body.description,
        user_id=user.id,
    )
    db.add(project)
    db.flush()
    if actor.is_guest and actor.guest_session:
        actor.guest_session.project_id = project.id
    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(project_id: UUID, actor: CurrentActor, db: DbSession):
    project = (
        db.query(Project)
        .options(joinedload(Project.images).joinedload(Image.versions))
        .filter(Project.id == project_id, Project.user_id == actor.user.id)
        .first()
    )
    if not project:
        raise AppError("Project not found", code="not_found", status_code=404)
    return ProjectDetail(
        id=project.id,
        name=project.name,
        description=project.description,
        created_at=project.created_at,
        updated_at=project.updated_at,
        images=[_image_out(img) for img in project.images],
    )


@router.delete("/{project_id}")
def delete_project(project_id: UUID, user: CurrentUser, db: DbSession):
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == user.id)
        .first()
    )
    if not project:
        raise AppError("Project not found", code="not_found", status_code=404)
    db.delete(project)
    db.commit()
    return {"message": "Deleted"}


@router.post("/{project_id}/upload", response_model=ImageOut)
async def upload_image(
    project_id: UUID,
    actor: CurrentActor,
    db: DbSession,
    file: UploadFile = File(...),
):
    if (
        get_settings().GUEST_LIMITS_ENABLED
        and actor.is_guest
        and actor.guest_session
        and actor.guest_session.image_count >= 1
    ):
        raise AppError(
            "Sign in to edit more images",
            code="guest_limit_images",
            status_code=401,
        )

    svc = ProcessingService(db)
    project = svc.get_owned_project(actor.user, project_id)
    data = await file.read()
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type == "image/jpg":
        content_type = "image/jpeg"
    allowed = set(get_settings().allowed_image_types_list)
    if content_type not in allowed:
        guessed = _guess_image_type(file.filename, data)
        if guessed in allowed:
            content_type = guessed
        else:
            raise AppError(
                "Unsupported file type",
                code="invalid_upload",
                status_code=400,
            )
    # One active image per project — replace on re-upload
    image = svc.replace_upload(
        actor.user,
        project,
        filename=file.filename or "upload.jpg",
        content_type=content_type,
        data=data,
    )
    if actor.is_guest and actor.guest_session:
        actor.guest_session.image_count += 1
        actor.guest_session.project_id = project_id
        db.commit()
    image = (
        db.query(Image)
        .options(joinedload(Image.versions))
        .filter(Image.id == image.id)
        .first()
    )
    return _image_out(image)


@router.post("/{project_id}/masks", response_model=MaskUploadOut)
async def upload_mask(
    project_id: UUID,
    actor: CurrentActor,
    db: DbSession,
    file: UploadFile = File(...),
):
    svc = ProcessingService(db)
    project = svc.get_owned_project(actor.user, project_id)
    data = await file.read()
    if not data:
        raise AppError("Empty mask", code="invalid_upload", status_code=400)
    if len(data) > get_settings().MAX_UPLOAD_BYTES:
        raise AppError("Mask too large", code="file_too_large", status_code=400)
    storage = get_storage()
    key = storage.build_key(actor.user.id, project.id, f"mask_{file.filename or 'mask.png'}")
    storage.upload_bytes(key, data, file.content_type or "image/png")
    return MaskUploadOut(mask_storage_key=key)


@router.post("/{project_id}/background-removal", response_model=JobOut)
def background_removal(
    project_id: UUID,
    body: BackgroundRemovalRequest,
    actor: CurrentActor,
    db: DbSession,
):
    if (
        get_settings().GUEST_LIMITS_ENABLED
        and actor.is_guest
        and actor.guest_session
        and actor.guest_session.job_count >= 1
    ):
        raise AppError(
            "Sign in to process more images",
            code="guest_limit_jobs",
            status_code=401,
        )
    svc = ProcessingService(db)
    job = svc.remove_background(
        actor.user,
        project_id,
        body.image_id,
        idempotency_key=body.idempotency_key,
        free=actor.is_guest,
    )
    if actor.is_guest and actor.guest_session and job.status == JobStatus.COMPLETED:
        actor.guest_session.job_count += 1
        db.commit()
    return _job_out(job)


@router.post("/{project_id}/resize", response_model=JobOut)
def resize_endpoint(
    project_id: UUID,
    body: ResizeRequest,
    actor: CurrentActor,
    db: DbSession,
):
    if (
        get_settings().GUEST_LIMITS_ENABLED
        and actor.is_guest
        and actor.guest_session
        and actor.guest_session.job_count >= 1
    ):
        raise AppError(
            "Sign in to process more images",
            code="guest_limit_jobs",
            status_code=401,
        )
    svc = ProcessingService(db)
    job = svc.resize(
        actor.user,
        project_id,
        body.image_id,
        width=body.width,
        height=body.height,
        aspect_ratio=body.aspect_ratio,
        version_id=body.version_id,
        free=actor.is_guest,
    )
    if actor.is_guest and actor.guest_session and job.status == JobStatus.COMPLETED:
        actor.guest_session.job_count += 1
        db.commit()
    return _job_out(job)


@router.post("/{project_id}/crop", response_model=JobOut)
def crop_endpoint(
    project_id: UUID,
    body: CropRequest,
    actor: CurrentActor,
    db: DbSession,
):
    if (
        get_settings().GUEST_LIMITS_ENABLED
        and actor.is_guest
        and actor.guest_session
        and actor.guest_session.job_count >= 1
    ):
        raise AppError(
            "Sign in to process more images",
            code="guest_limit_jobs",
            status_code=401,
        )
    svc = ProcessingService(db)
    job = svc.crop(
        actor.user,
        project_id,
        body.image_id,
        x=body.x,
        y=body.y,
        width=body.width,
        height=body.height,
        version_id=body.version_id,
        free=actor.is_guest,
    )
    if actor.is_guest and actor.guest_session and job.status == JobStatus.COMPLETED:
        actor.guest_session.job_count += 1
        db.commit()
    return _job_out(job)


@router.get("/{project_id}/jobs", response_model=list[JobOut])
def list_jobs(project_id: UUID, actor: CurrentActor, db: DbSession):
    svc = ProcessingService(db)
    svc.get_owned_project(actor.user, project_id)
    jobs = (
        db.query(ProcessingJob)
        .filter(ProcessingJob.project_id == project_id, ProcessingJob.user_id == actor.user.id)
        .order_by(ProcessingJob.created_at.desc())
        .all()
    )
    return [_job_out(j) for j in jobs]


@router.get("/versions/{version_id}/download")
def download_version(
    version_id: UUID,
    actor: CurrentActor,
    db: DbSession,
    format: Optional[str] = Query(default=None, alias="format"),
):
    if actor.is_guest:
        raise AppError(
            "Sign in to download your image",
            code="auth_required_download",
            status_code=401,
        )
    svc = ProcessingService(db)
    data, content_type, filename = svc.download_version(actor.user, version_id, fmt=format)
    return Response(
        content=data,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
