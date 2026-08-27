from fastapi import APIRouter

from app.api.deps import CurrentActor, DbSession
from app.schemas import (
    AutoEditAnalyzeRequest,
    AutoEditRunRequest,
    ExportPackRequest,
    OutcomeAnalyzeRequest,
    OutcomeRunRequest,
    ProductPipelineRequest,
)
from app.services.export_packs import ExportPackService
from app.services.export_presets import MARKETPLACE_PRESETS, SOCIAL_PRESETS
from app.services.pipelines import PipelineService

router = APIRouter()


@router.get("/presets")
def list_presets():
    return {"social": SOCIAL_PRESETS, "marketplace": MARKETPLACE_PRESETS}


@router.post("/packs")
def create_export_pack(body: ExportPackRequest, actor: CurrentActor, db: DbSession):
    return ExportPackService(db).create_pack(
        actor.user,
        project_id=body.project_id,
        image_id=body.image_id,
        version_id=body.version_id,
        group=body.group,
        fmt=body.format,
        quality=body.quality,
        strip_metadata=body.strip_metadata,
        preset_ids=body.preset_ids,
    )


@router.post("/pipelines/product")
def product_pipeline(body: ProductPipelineRequest, actor: CurrentActor, db: DbSession):
    return PipelineService(db).run_product_ready(
        actor.user,
        project_id=body.project_id,
        image_id=body.image_id,
        version_id=body.version_id,
        bg_color=body.bg_color,
        drop_shadow=body.drop_shadow,
        free=actor.is_guest,
    )


@router.post("/pipelines/auto-edit/analyze")
def auto_edit_analyze(body: AutoEditAnalyzeRequest, actor: CurrentActor, db: DbSession):
    return PipelineService(db).analyze_auto_edit(
        actor.user,
        project_id=body.project_id,
        image_id=body.image_id,
        version_id=body.version_id,
    )


@router.post("/pipelines/auto-edit/run")
def auto_edit_run(body: AutoEditRunRequest, actor: CurrentActor, db: DbSession):
    return PipelineService(db).run_auto_edit(
        actor.user,
        project_id=body.project_id,
        image_id=body.image_id,
        version_id=body.version_id,
        free=actor.is_guest,
        include_studio_bg=body.include_studio_bg,
        include_upscale=body.include_upscale,
        include_fit=body.include_fit,
        bg_color=body.bg_color,
    )


@router.post("/pipelines/outcomes/analyze")
def outcomes_analyze(body: OutcomeAnalyzeRequest, actor: CurrentActor, db: DbSession):
    return PipelineService(db).analyze_outcomes(
        actor.user,
        project_id=body.project_id,
        image_id=body.image_id,
        version_id=body.version_id,
    )


@router.post("/pipelines/outcomes/run")
def outcomes_run(body: OutcomeRunRequest, actor: CurrentActor, db: DbSession):
    return PipelineService(db).run_outcome(
        actor.user,
        project_id=body.project_id,
        image_id=body.image_id,
        outcome=body.outcome,
        version_id=body.version_id,
        free=actor.is_guest,
        intent_text=body.intent_text,
        bg_color=body.bg_color,
        export_pack=body.export_pack,
        variant=body.variant,
    )
