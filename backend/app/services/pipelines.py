"""Pipelines: product-ready pack + AI Auto Edit recipe."""

from __future__ import annotations

import logging
import uuid
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.models import ImageVersion, User
from app.services.export_packs import ExportPackService
from app.services.jobs import JobService
from app.services.processing import ProcessingService

logger = logging.getLogger(__name__)


def _center_crop_1x1(w: int, h: int) -> dict[str, int]:
    side = min(w, h)
    return {"x": (w - side) // 2, "y": (h - side) // 2, "width": side, "height": side}


def _center_crop_aspect(w: int, h: int, aw: float, ah: float) -> dict[str, int]:
    target = aw / ah
    current = w / h if h else 1
    if current > target:
        width = max(1, int(h * target))
        height = h
        x = (w - width) // 2
        return {"x": x, "y": 0, "width": width, "height": height}
    width = w
    height = max(1, int(w / target))
    y = (h - height) // 2
    return {"x": 0, "y": y, "width": width, "height": height}


class PipelineService:
    def __init__(self, db: Session):
        self.db = db
        self.jobs = JobService(db)
        self.packs = ExportPackService(db)
        self.proc = ProcessingService(db)
        self.settings = get_settings()

    def run_product_ready(
        self,
        user: User,
        *,
        project_id: uuid.UUID,
        image_id: uuid.UUID,
        version_id: Optional[uuid.UUID] = None,
        bg_color: str = "#FFFFFF",
        drop_shadow: bool = True,
        free: bool = False,
    ) -> dict[str, Any]:
        """Sequential jobs then marketplace ZIP from final version."""
        # 1) remove background
        cut = self.jobs.create_job(
            user,
            project_id=project_id,
            image_id=image_id,
            tool="remove_bg",
            model_id="bg-standard",
            version_id=version_id,
            params={},
            idempotency_key=f"pipe-cut-{image_id}-{uuid.uuid4().hex[:8]}",
            free=free,
        )
        if cut.status.value != "COMPLETED" or not cut.result_version_id:
            raise AppError(
                cut.error_message or "Cutout failed",
                code=cut.error_code or "pipeline_failed",
                status_code=502,
            )

        # 2) place on studio / white with shadow
        placed = self.jobs.create_job(
            user,
            project_id=project_id,
            image_id=image_id,
            tool="bg_replace",
            version_id=cut.result_version_id,
            params={
                "color": bg_color,
                "drop_shadow": drop_shadow,
                "subject_scale": 100,
                "position": "center",
                "skip_recut": True,
            },
            idempotency_key=f"pipe-bg-{image_id}-{uuid.uuid4().hex[:8]}",
            free=free,
        )
        if placed.status.value != "COMPLETED" or not placed.result_version_id:
            raise AppError(
                placed.error_message or "Background replace failed",
                code=placed.error_code or "pipeline_failed",
                status_code=502,
            )

        # 3) enhance
        enh = self.jobs.create_job(
            user,
            project_id=project_id,
            image_id=image_id,
            tool="enhance",
            version_id=placed.result_version_id,
            params={},
            idempotency_key=f"pipe-enh-{image_id}-{uuid.uuid4().hex[:8]}",
            free=free,
        )
        if enh.status.value != "COMPLETED" or not enh.result_version_id:
            raise AppError(
                enh.error_message or "Enhance failed",
                code=enh.error_code or "pipeline_failed",
                status_code=502,
            )

        pack = self.packs.create_pack(
            user,
            project_id=project_id,
            image_id=image_id,
            version_id=enh.result_version_id,
            group="marketplace",
            fmt="jpg",
            quality=92,
        )

        return {
            "pipeline": "product_ready",
            "cutout_job_id": str(cut.id),
            "bg_job_id": str(placed.id),
            "enhance_job_id": str(enh.id),
            "result_version_id": str(enh.result_version_id),
            "pack": pack,
        }

    def analyze_auto_edit(
        self,
        user: User,
        *,
        project_id: uuid.UUID,
        image_id: uuid.UUID,
        version_id: Optional[uuid.UUID] = None,
    ) -> dict[str, Any]:
        """Heuristics (+ dims) → human-readable recipe. No model names in UX copy."""
        project = self.proc.get_owned_project(user, project_id)
        image = self.proc.get_owned_image(user, image_id, project.id)
        _bytes, _ct, version = self.jobs._source_bytes(image, version_id)  # noqa: SLF001
        w = int(version.width or image.width or 0)
        h = int(version.height or image.height or 0)
        max_edge = max(w, h) if w and h else 0
        plan = self.jobs._user_plan(user)  # noqa: SLF001
        can_studio_bg = plan in ("pro", "business", "admin")

        fixes: list[dict[str, Any]] = [
            {
                "id": "enhance",
                "label": "Polish color & sharpness",
                "reason": "Lift contrast and clarity so the photo looks finished.",
                "tool": "enhance",
                "credits": self.settings.CREDIT_COST_ENHANCE,
                "included": True,
            }
        ]
        fixes.append(
            {
                "id": "cutout",
                "label": "Clean cutout",
                "reason": "Isolate the subject for a cleaner result.",
                "tool": "remove_bg",
                "credits": self.settings.CREDIT_COST_BACKGROUND_REMOVAL,
                "included": True,
            }
        )
        if can_studio_bg:
            fixes.append(
                {
                    "id": "studio_bg",
                    "label": "Studio background",
                    "reason": "Place on a soft white backdrop with light shadow.",
                    "tool": "bg_replace",
                    "credits": self.settings.CREDIT_COST_BG_REPLACE,
                    "included": True,
                }
            )
        else:
            fixes.append(
                {
                    "id": "studio_bg",
                    "label": "Studio background",
                    "reason": "Pro plan unlocks white studio backdrop + shadow.",
                    "tool": "bg_replace",
                    "credits": self.settings.CREDIT_COST_BG_REPLACE,
                    "included": False,
                }
            )

        include_upscale = max_edge > 0 and max_edge < 1800
        fixes.append(
            {
                "id": "upscale",
                "label": "Sharper export",
                "reason": (
                    "Image is under 1800px — upscale 2× for crisper downloads."
                    if include_upscale
                    else "Already large enough; skip upscale to save credits."
                ),
                "tool": "upscale",
                "credits": self.settings.CREDIT_COST_UPSCALE_2X,
                "included": include_upscale,
            }
        )

        include_fit = w > 0 and h > 0 and abs(w - h) / max(w, h) > 0.35
        fixes.append(
            {
                "id": "fit",
                "label": "Square social frame",
                "reason": (
                    "Crop to 1:1 so it fits Instagram / marketplace tiles."
                    if include_fit
                    else "Aspect is already balanced — keep framing."
                ),
                "tool": "crop",
                "credits": self.settings.CREDIT_COST_CROP,
                "included": include_fit,
            }
        )

        recipe_credits = sum(f["credits"] for f in fixes if f["included"])
        return {
            "recipe": "auto_polish",
            "recipe_label": "Auto polish",
            "recipe_credits": recipe_credits,
            "width": w,
            "height": h,
            "version_id": str(version.id),
            "fixes": fixes,
            "summary": "We'll polish, cut out"
            + (", add a studio look" if can_studio_bg else "")
            + (", sharpen" if include_upscale else "")
            + (", and square-crop" if include_fit else "")
            + ".",
        }

    def run_auto_edit(
        self,
        user: User,
        *,
        project_id: uuid.UUID,
        image_id: uuid.UUID,
        version_id: Optional[uuid.UUID] = None,
        free: bool = False,
        include_studio_bg: Optional[bool] = None,
        include_upscale: Optional[bool] = None,
        include_fit: Optional[bool] = None,
        bg_color: str = "#FFFFFF",
    ) -> dict[str, Any]:
        """Run Auto Edit recipe: enhance → cutout → [studio bg] → [upscale] → [1:1 crop]."""
        analysis = self.analyze_auto_edit(
            user, project_id=project_id, image_id=image_id, version_id=version_id
        )
        by_id = {f["id"]: f for f in analysis["fixes"]}

        def want(fid: str, override: Optional[bool]) -> bool:
            if override is not None:
                return override
            return bool(by_id.get(fid, {}).get("included"))

        do_studio = want("studio_bg", include_studio_bg) and by_id.get("studio_bg", {}).get(
            "included", False
        )
        # If caller forces studio but plan blocked, analysis marks included False — respect that
        if include_studio_bg is True and not by_id.get("studio_bg", {}).get("included"):
            do_studio = False
        do_upscale = want("upscale", include_upscale)
        do_fit = want("fit", include_fit)

        session_id = uuid.uuid4().hex[:12]
        job_ids: list[str] = []
        credits_total = 0
        current_vid: Optional[uuid.UUID] = (
            uuid.UUID(analysis["version_id"]) if analysis.get("version_id") else version_id
        )
        applied: list[str] = []

        def run_step(tool: str, *, model_id: Optional[str] = None, params: Optional[dict] = None):
            nonlocal current_vid, credits_total
            job = self.jobs.create_job(
                user,
                project_id=project_id,
                image_id=image_id,
                tool=tool,
                model_id=model_id,
                version_id=current_vid,
                params=params or {},
                idempotency_key=f"auto-{session_id}-{tool}-{uuid.uuid4().hex[:6]}",
                free=free,
            )
            job_ids.append(str(job.id))
            if job.credits_deducted:
                credits_total += job.credit_cost or 0
            if job.status.value != "COMPLETED" or not job.result_version_id:
                raise AppError(
                    job.error_message or f"{tool} failed",
                    code=job.error_code or "pipeline_failed",
                    status_code=502,
                )
            current_vid = job.result_version_id
            applied.append(tool)
            return job

        run_step("enhance")
        run_step("remove_bg", model_id="bg-standard")

        if do_studio:
            run_step(
                "bg_replace",
                params={
                    "color": bg_color,
                    "drop_shadow": True,
                    "subject_scale": 100,
                    "position": "center",
                    "skip_recut": True,
                },
            )

        if do_upscale:
            run_step("upscale", model_id="upscale-2x", params={"scale": 2})

        if do_fit and current_vid:
            ver = (
                self.db.query(ImageVersion)
                .filter(ImageVersion.id == current_vid, ImageVersion.image_id == image_id)
                .first()
            )
            vw = int(getattr(ver, "width", 0) or analysis.get("width") or 0)
            vh = int(getattr(ver, "height", 0) or analysis.get("height") or 0)
            if vw > 0 and vh > 0:
                run_step("crop", params=_center_crop_1x1(vw, vh))

        return {
            "pipeline": "auto_edit",
            "recipe": "auto_polish",
            "recipe_label": "Auto polish",
            "session_id": session_id,
            "job_ids": job_ids,
            "steps_applied": applied,
            "credits_charged": credits_total if not free else 0,
            "recipe_credits_estimate": analysis["recipe_credits"],
            "result_version_id": str(current_vid) if current_vid else None,
            "fixes": analysis["fixes"],
            "summary": analysis["summary"],
        }

    def _infer_outcome(self, text: Optional[str]) -> str:
        t = (text or "").lower()
        if any(
            k in t
            for k in (
                "store",
                "shop",
                "amazon",
                "shopify",
                "etsy",
                "ebay",
                "marketplace",
                "listing",
                "ecommerce",
                "e-commerce",
            )
        ):
            return "store_ready"
        if any(k in t for k in ("instagram", "ig ", "reel", "story", " ad", "ads", "social", "tiktok", "feed")):
            return "ig_ad"
        return "professional"

    def analyze_outcomes(
        self,
        user: User,
        *,
        project_id: uuid.UUID,
        image_id: uuid.UUID,
        version_id: Optional[uuid.UUID] = None,
    ) -> dict[str, Any]:
        """Insight + result cards. No tool names in user-facing strings."""
        project = self.proc.get_owned_project(user, project_id)
        image = self.proc.get_owned_image(user, image_id, project.id)
        _bytes, _ct, version = self.jobs._source_bytes(image, version_id)  # noqa: SLF001
        w = int(version.width or image.width or 0)
        h = int(version.height or image.height or 0)
        max_edge = max(w, h) if w and h else 0
        plan = self.jobs._user_plan(user)  # noqa: SLF001
        can_studio = plan in ("pro", "business", "admin")
        aspect_off = w > 0 and h > 0 and abs(w - h) / max(w, h) > 0.25
        small = max_edge > 0 and max_edge < 1800

        # Guess subject type from aspect / size heuristics (no vision yet)
        if w and h and 0.85 <= (w / h) <= 1.15:
            insight = "I understand your image. What would you like to achieve?"
            recommended = "store_ready"
        elif aspect_off and w > h:
            insight = "I understand your image. Ready to polish this for ads or listings."
            recommended = "ig_ad"
        else:
            insight = "I understand your image. What would you like to achieve?"
            recommended = "professional"

        s = self.settings

        def credits_store() -> int:
            n = s.CREDIT_COST_ENHANCE + s.CREDIT_COST_BACKGROUND_REMOVAL
            if can_studio:
                n += s.CREDIT_COST_BG_REPLACE
            if small:
                n += s.CREDIT_COST_UPSCALE_2X
            return n

        def credits_pro() -> int:
            n = s.CREDIT_COST_ENHANCE
            if small:
                n += s.CREDIT_COST_UPSCALE_2X
            if aspect_off:
                n += s.CREDIT_COST_CROP
            return n

        def credits_ig() -> int:
            n = s.CREDIT_COST_ENHANCE + s.CREDIT_COST_BACKGROUND_REMOVAL + s.CREDIT_COST_CROP
            if can_studio:
                n += s.CREDIT_COST_BG_REPLACE
            if small:
                n += s.CREDIT_COST_UPSCALE_2X
            return n

        outcomes = [
            {
                "id": "store_ready",
                "label": "Ready for Online Store",
                "blurb": "Clean backdrop, polish, soft shadow — ready for your shop.",
                "improves": [
                    "Removed distracting background",
                    "Enhanced lighting and color",
                    "Sharpened product details",
                    "Added natural shadow",
                    "Centered and optimized composition",
                    "Exported in high quality",
                ],
                "credits": credits_store(),
                "recommended": recommended == "store_ready",
            },
            {
                "id": "professional",
                "label": "Make it Professional",
                "blurb": "AI decides what to fix so the photo feels finished.",
                "improves": [
                    "Enhanced lighting and color",
                    "Sharpened details",
                    "Balanced composition",
                    "Exported in high quality",
                ],
                "credits": credits_pro(),
                "recommended": recommended == "professional",
            },
            {
                "id": "ig_ad",
                "label": "Create an Advertisement",
                "blurb": "Composition and size tuned for Instagram ads & feed.",
                "improves": [
                    "Removed distracting background",
                    "Enhanced lighting and color",
                    "Eye-catching polish",
                    "Feed-ready framing",
                    "Exported in high quality",
                ],
                "credits": credits_ig(),
                "recommended": recommended == "ig_ad",
            },
            {
                "id": "custom",
                "label": "Describe what you want",
                "blurb": "Tell Photopol the result in plain language.",
                "improves": ["AI mapped your request to the right edits", "Exported in high quality"],
                "credits": credits_pro(),
                "recommended": False,
            },
        ]

        return {
            "insight": insight,
            "recommended": recommended,
            "width": w,
            "height": h,
            "version_id": str(version.id),
            "outcomes": outcomes,
            "can_studio_bg": can_studio,
            "needs_upscale": small,
            "needs_fit": aspect_off,
        }

    def run_outcome(
        self,
        user: User,
        *,
        project_id: uuid.UUID,
        image_id: uuid.UUID,
        outcome: str,
        version_id: Optional[uuid.UUID] = None,
        free: bool = False,
        intent_text: Optional[str] = None,
        bg_color: str = "#FFFFFF",
        export_pack: bool = False,
        variant: Optional[str] = None,
    ) -> dict[str, Any]:
        """Run a result recipe. Tool IDs stay internal. Optional variant for alt looks."""
        analysis = self.analyze_outcomes(
            user, project_id=project_id, image_id=image_id, version_id=version_id
        )
        oid = (outcome or "").strip().lower()
        if oid == "custom":
            oid = self._infer_outcome(intent_text)
        if oid not in ("store_ready", "professional", "ig_ad"):
            oid = "professional"

        vid = (variant or "").strip().lower() or None
        # Variant presets override look params
        if vid == "premium_look":
            oid = "store_ready"
            bg_color = "#1C1917"
        elif vid == "white_bg":
            oid = "store_ready"
            bg_color = "#FFFFFF"
        elif vid == "lifestyle":
            oid = "store_ready"
            bg_color = "#F5F0E8"
        elif vid == "ig_square":
            oid = "ig_ad"
            bg_color = bg_color or "#F5F0E8"
        elif vid == "ig_story":
            oid = "ig_ad"
            bg_color = bg_color or "#F5F0E8"

        plan = self.jobs._user_plan(user)  # noqa: SLF001
        can_studio = plan in ("pro", "business", "admin") or free
        small = bool(analysis.get("needs_upscale"))
        aspect_off = bool(analysis.get("needs_fit"))

        labels = {
            "store_ready": "Ready for Online Store",
            "professional": "Make it Professional",
            "ig_ad": "Create an Advertisement",
        }
        variant_labels = {
            "premium_look": "Premium Look",
            "white_bg": "White Background",
            "lifestyle": "Lifestyle Scene",
            "ig_square": "Instagram Square",
            "ig_story": "Instagram Story",
        }
        improves_map = {
            "store_ready": [
                "Removed distracting background",
                "Enhanced lighting and color",
                "Sharpened product details",
                "Added natural shadow",
                "Centered and optimized composition",
                "Exported in high quality",
            ],
            "professional": [
                "Enhanced lighting and color",
                "Sharpened details",
                "Balanced composition",
                "Exported in high quality",
            ],
            "ig_ad": [
                "Removed distracting background",
                "Enhanced lighting and color",
                "Eye-catching polish",
                "Feed-ready framing",
                "Exported in high quality",
            ],
        }

        session_id = uuid.uuid4().hex[:12]
        job_ids: list[str] = []
        credits_total = 0
        current_vid: Optional[uuid.UUID] = (
            uuid.UUID(analysis["version_id"]) if analysis.get("version_id") else version_id
        )
        applied: list[str] = []
        improved: list[str] = []

        def run_step(tool: str, *, model_id: Optional[str] = None, params: Optional[dict] = None):
            nonlocal current_vid, credits_total
            job = self.jobs.create_job(
                user,
                project_id=project_id,
                image_id=image_id,
                tool=tool,
                model_id=model_id,
                version_id=current_vid,
                params=params or {},
                idempotency_key=f"out-{session_id}-{tool}-{uuid.uuid4().hex[:6]}",
                free=free,
            )
            job_ids.append(str(job.id))
            if job.credits_deducted:
                credits_total += job.credit_cost or 0
            if job.status.value != "COMPLETED" or not job.result_version_id:
                raise AppError(
                    job.error_message or "Edit failed",
                    code=job.error_code or "pipeline_failed",
                    status_code=502,
                )
            current_vid = job.result_version_id
            applied.append(tool)
            return job

        # Always start with polish
        run_step("enhance")
        improved.append("Enhanced lighting and color")
        improved.append("Sharpened product details")

        need_cut = oid in ("store_ready", "ig_ad") or vid in (
            "premium_look",
            "white_bg",
            "lifestyle",
            "ig_square",
            "ig_story",
        )
        if need_cut:
            run_step("remove_bg", model_id="bg-standard")
            improved.append("Removed distracting background")
            if can_studio or free:
                color = bg_color or ("#FFFFFF" if oid == "store_ready" else "#8B5CF6")
                drop = oid == "store_ready" or vid in ("premium_look", "white_bg", "lifestyle")
                run_step(
                    "bg_replace",
                    params={
                        "color": color,
                        "drop_shadow": drop,
                        "subject_scale": 100,
                        "position": "center",
                        "skip_recut": True,
                    },
                )
                if drop:
                    improved.append("Added natural shadow")
                improved.append("Centered and optimized composition")

        if small:
            run_step("upscale", model_id="upscale-2x", params={"scale": 2})
            if "Sharpened product details" not in improved:
                improved.append("Sharpened product details")

        # Framing
        if current_vid and (
            oid == "ig_ad"
            or vid in ("ig_square", "ig_story")
            or (oid == "professional" and aspect_off)
            or (oid == "store_ready" and aspect_off)
        ):
            ver = (
                self.db.query(ImageVersion)
                .filter(ImageVersion.id == current_vid, ImageVersion.image_id == image_id)
                .first()
            )
            vw = int(getattr(ver, "width", 0) or analysis.get("width") or 0)
            vh = int(getattr(ver, "height", 0) or analysis.get("height") or 0)
            if vw > 0 and vh > 0:
                if vid == "ig_story":
                    run_step("crop", params=_center_crop_aspect(vw, vh, 9, 16))
                    if "Centered and optimized composition" not in improved:
                        improved.append("Centered and optimized composition")
                elif oid == "ig_ad" or vid == "ig_square" or aspect_off:
                    run_step("crop", params=_center_crop_1x1(vw, vh))
                    if "Centered and optimized composition" not in improved:
                        improved.append("Centered and optimized composition")

        if current_vid and (oid == "ig_ad" or vid == "ig_square"):
            run_step("resize", params={"width": 1080, "height": 1080, "fit": "cover"})
            improved.append("Exported in high quality")
        elif current_vid and vid == "ig_story":
            run_step("resize", params={"width": 1080, "height": 1920, "fit": "cover"})
            improved.append("Exported in high quality")
        else:
            improved.append("Exported in high quality")

        pack = None
        if export_pack and oid == "store_ready" and current_vid and not vid:
            try:
                pack = self.packs.create_pack(
                    user,
                    project_id=project_id,
                    image_id=image_id,
                    version_id=current_vid,
                    group="marketplace",
                    fmt="jpg",
                    quality=92,
                )
            except Exception as e:  # noqa: BLE001
                logger.warning("outcome pack skipped: %s", e)

        seen: set[str] = set()
        what_we_improved = []
        for x in improved:
            if x not in seen:
                seen.add(x)
                what_we_improved.append(x)

        card = next((o for o in analysis["outcomes"] if o["id"] == oid), None)
        estimate = int(card["credits"]) if card else credits_total
        out_label = variant_labels.get(vid or "", labels.get(oid, "Edit"))

        return {
            "pipeline": "outcome",
            "outcome": oid,
            "variant": vid,
            "outcome_label": out_label,
            "session_id": session_id,
            "job_ids": job_ids,
            "steps_applied": applied,
            "credits_charged": credits_total if not free else 0,
            "recipe_credits_estimate": estimate,
            "result_version_id": str(current_vid) if current_vid else None,
            "what_we_improved": what_we_improved or improves_map.get(oid, []),
            "summary": f"Finished: {out_label}.",
            "insight": analysis.get("insight"),
            "pack": pack,
            "intent_text": intent_text,
        }
