from uuid import UUID

from fastapi import APIRouter, File, UploadFile, status
from fastapi.responses import JSONResponse

from app.api.deps import CurrentActor, DbSession
from app.core.errors import AppError
from app.models import ProcessingJob
from app.schemas import JobCreateRequest, JobOut
from app.services.jobs import JobService
from app.services.tool_registry import list_tools

router = APIRouter()


def _job_out(job: ProcessingJob) -> JobOut:
    return JobOut(
        id=job.id,
        job_type=job.job_type.value,
        tool=job.tool,
        model_id=job.model_id,
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


@router.get("/catalog")
def tool_catalog():
    return {
        "tools": [
            {
                "id": t.id,
                "label": t.label,
                "async": t.async_job,
                "models": [
                    {
                        "id": m.id,
                        "credits": m.credits,
                        "plan_min": m.plan_min,
                    }
                    for m in t.models
                ],
            }
            for t in list_tools()
        ]
    }


@router.post("", status_code=status.HTTP_202_ACCEPTED)
def create_job(body: JobCreateRequest, actor: CurrentActor, db: DbSession):
    free = actor.is_guest
    job = JobService(db).create_job(
        actor.user,
        project_id=body.project_id,
        image_id=body.image_id,
        tool=body.tool,
        model_id=body.model_id,
        params=body.params,
        version_id=body.version_id,
        idempotency_key=body.idempotency_key,
        free=free,
    )
    if job.status.value == "FAILED":
        raise AppError(
            job.error_message or "Processing failed",
            code=job.error_code or "job_failed",
            status_code=502,
        )
    code = 200 if job.status.value == "COMPLETED" else 202
    return JSONResponse(status_code=code, content=_job_out(job).model_dump(mode="json"))


@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: UUID, actor: CurrentActor, db: DbSession):
    return _job_out(JobService(db).get_owned_job(actor.user, job_id))


@router.post("/{job_id}/cancel", response_model=JobOut)
def cancel_job(job_id: UUID, actor: CurrentActor, db: DbSession):
    return _job_out(JobService(db).cancel_job(actor.user, job_id))
