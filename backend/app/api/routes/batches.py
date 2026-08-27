from uuid import UUID

from fastapi import APIRouter, status
from fastapi.responses import Response

from app.api.deps import CurrentActor, DbSession
from app.schemas import BatchCreateRequest
from app.services.batches import BatchService

router = APIRouter()


@router.post("", status_code=status.HTTP_202_ACCEPTED)
def create_batch(body: BatchCreateRequest, actor: CurrentActor, db: DbSession):
    return BatchService(db).create_batch(
        actor.user,
        project_id=body.project_id,
        image_ids=body.image_ids,
        tool=body.tool,
        model_id=body.model_id,
        params=body.params,
        free=actor.is_guest,
    )


@router.get("/{batch_id}")
def get_batch(batch_id: UUID, actor: CurrentActor, db: DbSession):
    return BatchService(db).get_batch(actor.user, batch_id)


@router.get("/{batch_id}/zip")
def download_batch_zip(batch_id: UUID, actor: CurrentActor, db: DbSession):
    data, filename = BatchService(db).build_zip(actor.user, batch_id)
    return Response(
        content=data,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
