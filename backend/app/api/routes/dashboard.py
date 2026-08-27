from datetime import datetime, timezone

from fastapi import APIRouter
from sqlalchemy import func

from app.api.deps import CurrentUser, DbSession
from app.models import Image, ImageVersion, ImageVersionKind, JobStatus, ProcessingJob, Project
from app.schemas import DashboardStats, RecentProjectOut
from app.services.storage import get_storage

router = APIRouter()


def _op_label(operation: str | None, kind: str) -> str:
    if kind == ImageVersionKind.ORIGINAL.value or kind == "ORIGINAL":
        return "Original"
    op = (operation or "").lower()
    if "background" in op or "bg" in op:
        return "Background Removed"
    if "resize" in op:
        return "Resized"
    if "crop" in op:
        return "Cropped"
    return "Edited"


@router.get("/stats", response_model=DashboardStats)
def stats(user: CurrentUser, db: DbSession):
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    images_processed = (
        db.query(func.count(ProcessingJob.id))
        .filter(
            ProcessingJob.user_id == user.id,
            ProcessingJob.status == JobStatus.COMPLETED,
            ProcessingJob.created_at >= month_start,
        )
        .scalar()
        or 0
    )
    storage_used = (
        db.query(func.coalesce(func.sum(Image.byte_size), 0))
        .filter(Image.user_id == user.id)
        .scalar()
        or 0
    )
    project_count = (
        db.query(func.count(Project.id)).filter(Project.user_id == user.id).scalar() or 0
    )
    return DashboardStats(
        credit_balance=user.credit_balance,
        images_processed=int(images_processed),
        storage_used_bytes=int(storage_used),
        project_count=int(project_count),
        full_name=user.full_name,
        email=user.email,
    )


@router.get("/recent-projects", response_model=list[RecentProjectOut])
def recent_projects(user: CurrentUser, db: DbSession):
    storage = get_storage()
    projects = (
        db.query(Project)
        .filter(Project.user_id == user.id)
        .order_by(Project.updated_at.desc())
        .limit(8)
        .all()
    )
    out: list[RecentProjectOut] = []
    for p in projects:
        thumb = None
        last_op = None
        image = (
            db.query(Image)
            .filter(Image.project_id == p.id, Image.user_id == user.id)
            .order_by(Image.created_at.desc())
            .first()
        )
        if image:
            version = (
                db.query(ImageVersion)
                .filter(ImageVersion.image_id == image.id)
                .order_by(ImageVersion.created_at.desc())
                .first()
            )
            if version:
                thumb = storage.public_url(version.storage_key)
                last_op = _op_label(version.operation, getattr(version.kind, "value", str(version.kind)))
            else:
                thumb = storage.public_url(image.storage_key)
                last_op = "Original"
        out.append(
            RecentProjectOut(
                id=p.id,
                name=p.name,
                description=p.description,
                created_at=p.created_at,
                updated_at=p.updated_at,
                thumbnail_url=thumb,
                last_operation=last_op,
            )
        )
    return out
