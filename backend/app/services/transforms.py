"""Non-bg AI transforms: object remove, upscale, enhance, bg replace."""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass
from typing import Optional

from PIL import Image as PILImage
from PIL import ImageEnhance, ImageFilter, ImageOps

from app.core.config import get_settings
from app.core.errors import AppError
from app.services.ai import get_ai_service

logger = logging.getLogger(__name__)


@dataclass
class TransformResult:
    image_bytes: bytes
    content_type: str
    provider: str = "local"
    provider_job_id: Optional[str] = None
    meta: Optional[dict] = None


def _replicate_run(model: str, input_payload: dict) -> bytes:
    import httpx
    import replicate
    from replicate.exceptions import ReplicateError

    settings = get_settings()
    if not settings.REPLICATE_API_TOKEN:
        raise AppError(
            "AI provider is not configured. Set REPLICATE_API_TOKEN.",
            code="ai_not_configured",
            status_code=503,
        )
    client = replicate.Client(api_token=settings.REPLICATE_API_TOKEN)
    last_exc: Exception | None = None
    output = None
    try:
        for attempt in range(5):
            try:
                output = client.run(model, input=input_payload)
                last_exc = None
                break
            except ReplicateError as exc:
                last_exc = exc
                status = getattr(exc, "status", None) or getattr(exc, "status_code", None)
                try:
                    status_i = int(status) if status is not None else None
                except (TypeError, ValueError):
                    status_i = None
                detail = str(exc)
                if status_i == 402 or "Insufficient credit" in detail:
                    raise AppError(
                        "Replicate account has no credit.",
                        code="ai_insufficient_credit",
                        status_code=402,
                    ) from exc
                if status_i == 429 or "throttled" in detail.lower() or "rate limit" in detail.lower():
                    import re
                    import time

                    wait = 8.0
                    m = re.search(r"resets in ~?(\d+)", detail, re.I)
                    if m:
                        wait = max(wait, float(m.group(1)) + 1.0)
                    logger.warning("Replicate rate-limited (attempt %s); sleeping %.1fs", attempt + 1, wait)
                    time.sleep(wait)
                    # BytesIO inputs need rewind between retries
                    for v in input_payload.values():
                        if hasattr(v, "seek"):
                            try:
                                v.seek(0)
                            except Exception:  # noqa: BLE001
                                pass
                    continue
                logger.exception("Replicate transform failed")
                raise AppError("AI processing failed", code="ai_provider_error", status_code=502) from exc
        if last_exc is not None:
            status = getattr(last_exc, "status", None) or getattr(last_exc, "status_code", None)
            try:
                status_i = int(status) if status is not None else None
            except (TypeError, ValueError):
                status_i = None
            detail = str(last_exc)
            if status_i == 429 or "throttled" in detail.lower() or "rate limit" in detail.lower():
                raise AppError(
                    "AI provider is rate-limited. Wait and retry (or add ≥$5 Replicate credit).",
                    code="ai_rate_limited",
                    status_code=429,
                ) from last_exc
            raise AppError("AI processing failed", code="ai_provider_error", status_code=502) from last_exc
    except AppError:
        raise
    except Exception as exc:
        logger.exception("Replicate transform failed")
        raise AppError("AI processing failed", code="ai_provider_error", status_code=502) from exc

    assert output is not None

    if isinstance(output, (list, tuple)) and output:
        output = output[0]

    url = None
    if isinstance(output, str) and output.startswith("http"):
        url = output
    else:
        maybe = getattr(output, "url", None)
        if maybe:
            url = str(maybe)
        else:
            as_str = str(output)
            if as_str.startswith("http"):
                url = as_str

    if url:
        resp = httpx.get(url, timeout=180.0, follow_redirects=True)
        resp.raise_for_status()
        if resp.content:
            return resp.content

    if hasattr(output, "read"):
        data = output.read()
        if isinstance(data, bytes) and data:
            return data
        if data:
            return bytes(data)

    raise AppError("Unrecognized AI result", code="ai_provider_error", status_code=502)


def _to_data_uri(image_bytes: bytes, content_type: str) -> str:
    import base64

    b64 = base64.b64encode(image_bytes).decode("ascii")
    return f"data:{content_type};base64,{b64}"


def local_upscale(image_bytes: bytes, scale: int) -> TransformResult:
    img = PILImage.open(io.BytesIO(image_bytes))
    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
    w, h = img.size
    out = img.resize((w * scale, h * scale), PILImage.Resampling.LANCZOS)
    buf = io.BytesIO()
    fmt = "PNG" if out.mode == "RGBA" else "JPEG"
    out.save(buf, format=fmt, quality=92)
    return TransformResult(
        image_bytes=buf.getvalue(),
        content_type="image/png" if fmt == "PNG" else "image/jpeg",
        provider="local_upscale",
        meta={"scale": scale},
    )


def local_enhance(image_bytes: bytes) -> TransformResult:
    img = PILImage.open(io.BytesIO(image_bytes))
    img = ImageOps.exif_transpose(img)
    if img.mode == "RGBA":
        base = img.convert("RGB")
        alpha = img.split()[-1]
        base = ImageOps.autocontrast(base, cutoff=1)
        base = ImageEnhance.Sharpness(base).enhance(1.35)
        base = ImageEnhance.Color(base).enhance(1.12)
        base = base.filter(ImageFilter.UnsharpMask(radius=1.2, percent=120, threshold=2))
        base.putalpha(alpha)
        out = base
        fmt = "PNG"
    else:
        out = img.convert("RGB")
        out = ImageOps.autocontrast(out, cutoff=1)
        out = ImageEnhance.Sharpness(out).enhance(1.35)
        out = ImageEnhance.Color(out).enhance(1.12)
        out = out.filter(ImageFilter.UnsharpMask(radius=1.2, percent=120, threshold=2))
        fmt = "JPEG"
    buf = io.BytesIO()
    out.save(buf, format=fmt, quality=92)
    return TransformResult(
        image_bytes=buf.getvalue(),
        content_type="image/png" if fmt == "PNG" else "image/jpeg",
        provider="local_enhance",
    )


def local_object_remove(image_bytes: bytes, mask_bytes: bytes) -> TransformResult:
    """Erase masked pixels (transparent). Dev/fallback when no Replicate."""
    img = PILImage.open(io.BytesIO(image_bytes)).convert("RGBA")
    mask = PILImage.open(io.BytesIO(mask_bytes)).convert("L")
    if mask.size != img.size:
        mask = mask.resize(img.size, PILImage.Resampling.NEAREST)
    clear = PILImage.new("RGBA", img.size, (0, 0, 0, 0))
    keep_mask = mask.point(lambda v: 0 if v > 128 else 255)
    out = PILImage.composite(img, clear, keep_mask)
    buf = io.BytesIO()
    out.save(buf, format="PNG")
    return TransformResult(
        image_bytes=buf.getvalue(),
        content_type="image/png",
        provider="local_object_remove",
    )


def local_bg_replace(image_bytes: bytes, *, color: str = "#8B5CF6") -> TransformResult:
    cut = get_ai_service().remove_background(image_bytes, "image/png")
    fg = PILImage.open(io.BytesIO(cut.image_bytes)).convert("RGBA")
    color = (color or "#8B5CF6").lstrip("#")
    if len(color) == 3:
        color = "".join(c * 2 for c in color)
    r, g, b = int(color[0:2], 16), int(color[2:4], 16), int(color[4:6], 16)
    bg = PILImage.new("RGBA", fg.size, (r, g, b, 255))
    out = PILImage.alpha_composite(bg, fg).convert("RGB")
    buf = io.BytesIO()
    out.save(buf, format="JPEG", quality=92)
    return TransformResult(
        image_bytes=buf.getvalue(),
        content_type="image/jpeg",
        provider=f"local_bg_replace+{cut.provider}",
        meta={"color": f"#{color}"},
    )


def _replicate_only() -> bool:
    return (get_settings().AI_BG_PROVIDER or "").lower() == "replicate"


def run_upscale(image_bytes: bytes, content_type: str, *, scale: int, model: str) -> TransformResult:
    settings = get_settings()
    strict = _replicate_only()
    # Primary: Replicate
    if settings.REPLICATE_API_TOKEN and model:
        try:
            file_input = io.BytesIO(image_bytes)
            file_input.name = "input.png"
            raw = _replicate_run(
                model,
                {"image": file_input, "scale": scale},
            )
            return TransformResult(
                image_bytes=raw,
                content_type="image/png",
                provider="replicate",
                meta={"scale": scale, "model": model},
            )
        except AppError as exc:
            if strict or exc.code == "ai_not_configured":
                raise
            logger.warning("Replicate upscale failed (%s); trying fal/local", exc.code)
    elif strict:
        raise AppError(
            "AI provider is not configured. Set REPLICATE_API_TOKEN.",
            code="ai_not_configured",
            status_code=503,
        )
    # Failover: fal.ai (optional) — skipped when AI_BG_PROVIDER=replicate
    fal_key = getattr(settings, "FAL_KEY", "") or ""
    fal_model = getattr(settings, "FAL_UPSCALE_MODEL", "") or "fal-ai/esrgan"
    if fal_key:
        try:
            return _fal_upscale(image_bytes, scale=scale, api_key=fal_key, model=fal_model)
        except Exception:
            logger.exception("fal upscale failed; local fallback")
    return local_upscale(image_bytes, scale)


def _fal_upscale(image_bytes: bytes, *, scale: int, api_key: str, model: str) -> TransformResult:
    import base64
    import httpx

    b64 = base64.b64encode(image_bytes).decode("ascii")
    data_uri = f"data:image/png;base64,{b64}"
    resp = httpx.post(
        f"https://fal.run/{model}",
        headers={"Authorization": f"Key {api_key}", "Content-Type": "application/json"},
        json={"image_url": data_uri, "scale": scale},
        timeout=180.0,
    )
    if resp.status_code >= 400:
        raise AppError("fal upscale failed", code="ai_provider_error", status_code=502)
    payload = resp.json()
    url = (payload.get("image") or {}).get("url") or payload.get("image_url")
    if not url:
        raise AppError("fal empty result", code="ai_provider_error", status_code=502)
    img = httpx.get(url, timeout=180.0)
    img.raise_for_status()
    return TransformResult(
        image_bytes=img.content,
        content_type="image/png",
        provider="fal",
        meta={"scale": scale, "model": model},
    )


def run_object_remove(
    image_bytes: bytes,
    content_type: str,
    mask_bytes: bytes,
    *,
    model: str,
) -> TransformResult:
    settings = get_settings()
    strict = _replicate_only()
    if settings.REPLICATE_API_TOKEN and model:
        try:
            img_f = io.BytesIO(image_bytes)
            img_f.name = "image.png"
            mask_f = io.BytesIO(mask_bytes)
            mask_f.name = "mask.png"
            raw = _replicate_run(
                model,
                {
                    "image": img_f,
                    "mask": mask_f,
                },
            )
            return TransformResult(
                image_bytes=raw,
                content_type="image/png",
                provider="replicate",
                meta={"model": model},
            )
        except AppError as exc:
            if strict or exc.code == "ai_not_configured":
                raise
            logger.warning("Replicate object remove failed (%s); local fallback", exc.code)
    elif strict:
        raise AppError(
            "AI provider is not configured. Set REPLICATE_API_TOKEN.",
            code="ai_not_configured",
            status_code=503,
        )
    return local_object_remove(image_bytes, mask_bytes)


def run_enhance(image_bytes: bytes, content_type: str, *, model: str) -> TransformResult:
    settings = get_settings()
    strict = _replicate_only()
    if settings.REPLICATE_API_TOKEN and model:
        try:
            file_input = io.BytesIO(image_bytes)
            file_input.name = "input.png"
            # Real-ESRGAN defaults to scale=4; keep size for "enhance" (sharpen/polish only).
            raw = _replicate_run(model, {"image": file_input, "scale": 1, "face_enhance": False})
            return TransformResult(
                image_bytes=raw,
                content_type="image/png",
                provider="replicate",
                meta={"model": model, "scale": 1},
            )
        except AppError as exc:
            if strict or exc.code == "ai_not_configured":
                raise
            logger.warning("Replicate enhance failed (%s); local fallback", exc.code)
    elif strict:
        raise AppError(
            "AI provider is not configured. Set REPLICATE_API_TOKEN.",
            code="ai_not_configured",
            status_code=503,
        )
    return local_enhance(image_bytes)


def _wrap_ai_edit_prompt(user_prompt: str) -> str:
    text = (user_prompt or "").strip()
    return (
        "Edit this photo according to the user's request. "
        "Preserve the main subject identity, product details, and overall framing "
        "unless the user explicitly asks to change them.\n"
        f"User request: {text}"
    )


def run_ai_edit(
    image_bytes: bytes,
    content_type: str,
    *,
    prompt: str,
    model: str,
) -> TransformResult:
    """Instruction-following image edit via Replicate (Flux Kontext)."""
    settings = get_settings()
    text = (prompt or "").strip()
    if not text:
        raise AppError("Describe what you want to change.", code="prompt_required", status_code=400)
    if not settings.REPLICATE_API_TOKEN:
        raise AppError(
            "AI provider is not configured. Set REPLICATE_API_TOKEN.",
            code="ai_not_configured",
            status_code=503,
        )
    if not model:
        model = settings.REPLICATE_AI_EDIT_MODEL
    file_input = io.BytesIO(image_bytes)
    ext = "png"
    ct = (content_type or "").lower()
    if "jpeg" in ct or "jpg" in ct:
        ext = "jpg"
    elif "webp" in ct:
        ext = "webp"
    file_input.name = f"input.{ext}"
    raw = _replicate_run(
        model,
        {
            "prompt": _wrap_ai_edit_prompt(text),
            "input_image": file_input,
            "aspect_ratio": "match_input_image",
            "output_format": "png",
            "safety_tolerance": 2,
        },
    )
    return TransformResult(
        image_bytes=raw,
        content_type="image/png",
        provider="replicate",
        meta={"model": model, "prompt": text},
    )


def run_bg_replace(
    image_bytes: bytes,
    content_type: str,
    *,
    color: str = "#8B5CF6",
    prompt: Optional[str] = None,
    drop_shadow: bool = False,
    subject_scale: float = 100,
    position: str = "center",
) -> TransformResult:
    _ = prompt
    cut = get_ai_service().remove_background(image_bytes, content_type or "image/png")
    from app.services.image_ops import composite_on_color

    out_bytes, out_ct, w, h = composite_on_color(
        cut.image_bytes,
        color=color,
        drop_shadow=drop_shadow,
        subject_scale=subject_scale,
        position=position,
    )
    return TransformResult(
        image_bytes=out_bytes,
        content_type=out_ct,
        provider=f"bg_replace+{cut.provider}",
        meta={"color": color, "drop_shadow": drop_shadow, "width": w, "height": h},
    )
