"""Phase 2 tool + model registry (credits, plans, providers)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from app.core.config import get_settings
from app.core.errors import AppError
from app.models import JobType

PLAN_RANK = {"free": 0, "pro": 1, "business": 2}

PLAN_ALLOWANCE = {
    "free": 0,
    "pro": 500,
    "business": 2000,
}

PLAN_PRIORITY = {"free": 0, "pro": 10, "business": 20}
PLAN_MAX_CONCURRENT = {"free": 1, "pro": 3, "business": 8}
PLAN_BATCH_SIZE = {"free": 1, "pro": 5, "business": 20}


@dataclass(frozen=True)
class ModelDef:
    id: str
    credits: int
    plan_min: str = "free"
    provider: str = "auto"
    replicate_model: Optional[str] = None
    default_params: Optional[Dict[str, Any]] = None


@dataclass(frozen=True)
class ToolDef:
    id: str
    job_type: JobType
    label: str
    async_job: bool
    models: List[ModelDef]


def _registry() -> Dict[str, ToolDef]:
    s = get_settings()
    return {
        "remove_bg": ToolDef(
            id="remove_bg",
            job_type=JobType.BACKGROUND_REMOVAL,
            label="Remove Background",
            async_job=True,
            models=[
                ModelDef(
                    id="bg-fast",
                    credits=max(1, s.CREDIT_COST_BACKGROUND_REMOVAL - 3),
                    plan_min="free",
                    provider="local",
                ),
                ModelDef(
                    id="bg-standard",
                    credits=s.CREDIT_COST_BACKGROUND_REMOVAL,
                    plan_min="free",
                    provider="auto",
                    replicate_model=s.REPLICATE_BG_REMOVAL_MODEL,
                ),
                ModelDef(
                    id="bg-pro",
                    credits=s.CREDIT_COST_BG_PRO,
                    plan_min="pro",
                    provider="removebg",
                ),
            ],
        ),
        "resize": ToolDef(
            id="resize",
            job_type=JobType.RESIZE,
            label="Resize",
            async_job=False,
            models=[ModelDef(id="resize-local", credits=s.CREDIT_COST_RESIZE, provider="local")],
        ),
        "crop": ToolDef(
            id="crop",
            job_type=JobType.CROP,
            label="Crop",
            async_job=False,
            models=[ModelDef(id="crop-local", credits=s.CREDIT_COST_CROP, provider="local")],
        ),
        "object_remove": ToolDef(
            id="object_remove",
            job_type=JobType.OBJECT_REMOVE,
            label="Object Remove",
            async_job=True,
            models=[
                ModelDef(
                    id="object-fast",
                    credits=s.CREDIT_COST_OBJECT_REMOVE,
                    plan_min="free",
                    provider="auto",
                    replicate_model=s.REPLICATE_OBJECT_REMOVE_MODEL,
                ),
                ModelDef(
                    id="object-best",
                    credits=s.CREDIT_COST_OBJECT_REMOVE_BEST,
                    plan_min="pro",
                    provider="replicate",
                    replicate_model=s.REPLICATE_OBJECT_REMOVE_MODEL,
                ),
            ],
        ),
        "upscale": ToolDef(
            id="upscale",
            job_type=JobType.UPSCALE,
            label="Upscale",
            async_job=True,
            models=[
                ModelDef(
                    id="upscale-2x",
                    credits=s.CREDIT_COST_UPSCALE_2X,
                    plan_min="free",
                    provider="auto",
                    replicate_model=s.REPLICATE_UPSCALE_MODEL,
                    default_params={"scale": 2},
                ),
                ModelDef(
                    id="upscale-4x",
                    credits=s.CREDIT_COST_UPSCALE_4X,
                    plan_min="pro",
                    provider="auto",
                    replicate_model=s.REPLICATE_UPSCALE_MODEL,
                    default_params={"scale": 4},
                ),
            ],
        ),
        "enhance": ToolDef(
            id="enhance",
            job_type=JobType.ENHANCE,
            label="Enhance",
            async_job=True,
            models=[
                ModelDef(
                    id="enhance-standard",
                    credits=s.CREDIT_COST_ENHANCE,
                    plan_min="free",
                    provider="auto",
                    replicate_model=s.REPLICATE_ENHANCE_MODEL,
                ),
            ],
        ),
        "bg_replace": ToolDef(
            id="bg_replace",
            job_type=JobType.BG_REPLACE,
            label="Background Replace",
            async_job=True,
            models=[
                ModelDef(
                    id="bg-replace-standard",
                    credits=s.CREDIT_COST_BG_REPLACE,
                    plan_min="pro",
                    provider="auto",
                ),
            ],
        ),
        "ai_edit": ToolDef(
            id="ai_edit",
            job_type=JobType.ENHANCE,
            label="Ask AI Edit",
            async_job=True,
            models=[
                ModelDef(
                    id="ai-edit-kontext",
                    credits=s.CREDIT_COST_AI_EDIT,
                    plan_min="free",
                    provider="replicate",
                    replicate_model=s.REPLICATE_AI_EDIT_MODEL,
                ),
            ],
        ),
    }


def list_tools() -> List[ToolDef]:
    return list(_registry().values())


def get_tool(tool_id: str) -> ToolDef:
    reg = _registry()
    if tool_id not in reg:
        raise AppError(f"Unknown tool: {tool_id}", code="unknown_tool", status_code=400)
    return reg[tool_id]


def get_model(tool_id: str, model_id: Optional[str] = None) -> ModelDef:
    tool = get_tool(tool_id)
    if model_id:
        for m in tool.models:
            if m.id == model_id:
                return m
        raise AppError(f"Unknown model: {model_id}", code="unknown_model", status_code=400)
    return tool.models[0]


def assert_plan_allows(plan_id: str, model: ModelDef) -> None:
    user_rank = PLAN_RANK.get(plan_id or "free", 0)
    need = PLAN_RANK.get(model.plan_min, 0)
    if user_rank < need:
        raise AppError(
            f"Upgrade to {model.plan_min} to use this model",
            code="plan_required",
            status_code=403,
        )


def effective_plan(user_plan: Optional[str], subscription_status: Optional[str] = None) -> str:
    plan = (user_plan or "free").lower()
    if plan != "free" and subscription_status and subscription_status not in (
        "active",
        "trialing",
    ):
        return "free"
    return plan if plan in PLAN_RANK else "free"
