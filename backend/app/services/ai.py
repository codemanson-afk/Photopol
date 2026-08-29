from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

from app.core.config import get_settings
from app.core.errors import AppError

logger = logging.getLogger(__name__)


@dataclass
class BackgroundRemovalResult:
    image_bytes: bytes
    content_type: str
    provider_job_id: Optional[str] = None
    provider: str = "unknown"


class BackgroundRemovalProvider(ABC):
    @abstractmethod
    def remove_background(self, image_bytes: bytes, content_type: str) -> BackgroundRemovalResult:
        raise NotImplementedError


class LocalRembgProvider(BackgroundRemovalProvider):
    """Local ONNX rembg — free, no API credits. Uses lightweight u2netp."""

    def remove_background(self, image_bytes: bytes, content_type: str) -> BackgroundRemovalResult:
        try:
            from rembg import new_session, remove
        except ImportError as exc:
            raise AppError(
                "Local rembg is not installed. pip install 'rembg[cpu]'",
                code="ai_not_configured",
                status_code=503,
            ) from exc
        try:
            session = new_session("u2netp")
            out = remove(image_bytes, session=session)
            return BackgroundRemovalResult(
                image_bytes=out,
                content_type="image/png",
                provider="local_rembg",
            )
        except Exception as exc:
            logger.exception("Local rembg failed")
            raise AppError(
                "AI processing failed. Please try again.",
                code="ai_provider_error",
                status_code=502,
            ) from exc


class RemoveBgProvider(BackgroundRemovalProvider):
    """remove.bg REST API — https://www.remove.bg/api"""

    API_URL = "https://api.remove.bg/v1.0/removebg"

    def __init__(self) -> None:
        settings = get_settings()
        self.api_key = settings.REMOVEBG_API_KEY
        if not self.api_key:
            raise AppError(
                "remove.bg is not configured. Set REMOVEBG_API_KEY.",
                code="ai_not_configured",
                status_code=503,
            )

    def remove_background(self, image_bytes: bytes, content_type: str) -> BackgroundRemovalResult:
        import httpx

        ext = "png"
        if "jpeg" in content_type or "jpg" in content_type:
            ext = "jpg"
        elif "webp" in content_type:
            ext = "webp"

        try:
            resp = httpx.post(
                self.API_URL,
                headers={"X-Api-Key": self.api_key},
                files={"image_file": (f"input.{ext}", image_bytes, content_type or "image/png")},
                data={"size": "auto", "format": "png"},
                timeout=120.0,
            )
        except Exception as exc:
            logger.exception("remove.bg request failed")
            raise AppError(
                "AI processing failed. Please try again.",
                code="ai_provider_error",
                status_code=502,
            ) from exc

        if resp.status_code == 200:
            return BackgroundRemovalResult(
                image_bytes=resp.content,
                content_type="image/png",
                provider="removebg",
            )

        detail = ""
        try:
            err = resp.json()
            errors = err.get("errors") or []
            if errors:
                detail = str(errors[0].get("title") or errors[0].get("code") or "")
        except Exception:
            detail = resp.text[:200]

        if resp.status_code in (402, 429) or "insufficient" in detail.lower():
            raise AppError(
                "remove.bg quota exceeded. Add credits or wait for reset.",
                code="ai_insufficient_credit",
                status_code=402,
            )
        if resp.status_code == 403:
            raise AppError(
                "remove.bg API key rejected. Check REMOVEBG_API_KEY.",
                code="ai_not_configured",
                status_code=503,
            )

        detail_l = detail.lower()
        if resp.status_code == 400 and (
            "foreground" in detail_l or "supported-images" in detail_l or "could not identify" in detail_l
        ):
            raise AppError(
                "Could not detect a subject in this image.",
                code="ai_no_foreground",
                status_code=422,
            )

        logger.error("remove.bg error status=%s detail=%s", resp.status_code, detail)
        raise AppError(
            "AI processing failed. Please try again.",
            code="ai_provider_error",
            status_code=502,
        )


class ReplicateBackgroundRemovalProvider(BackgroundRemovalProvider):
    """Recraft Remove Background via Replicate."""

    def __init__(self) -> None:
        settings = get_settings()
        self.token = settings.REPLICATE_API_TOKEN
        self.model = settings.REPLICATE_BG_REMOVAL_MODEL
        if not self.token:
            raise AppError(
                "AI provider is not configured. Set REPLICATE_API_TOKEN.",
                code="ai_not_configured",
                status_code=503,
            )

    def remove_background(self, image_bytes: bytes, content_type: str) -> BackgroundRemovalResult:
        import io

        import replicate
        from replicate.exceptions import ReplicateError

        client = replicate.Client(api_token=self.token)
        try:
            file_input = io.BytesIO(image_bytes)
            file_input.name = "input.png"

            output = None
            last_exc: Exception | None = None
            for attempt in range(5):
                try:
                    file_input.seek(0)
                    output = client.run(
                        self.model,
                        input={"image": file_input},
                    )
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
                            "Replicate account has no credit. Add billing at replicate.com/account/billing",
                            code="ai_insufficient_credit",
                            status_code=402,
                        ) from exc
                    if status_i == 429 or "throttled" in detail.lower() or "rate limit" in detail.lower():
                        import time
                        import re

                        wait = 8.0
                        m = re.search(r"resets in ~?(\d+)", detail, re.I)
                        if m:
                            wait = max(wait, float(m.group(1)) + 1.0)
                        logger.warning("Replicate rate-limited (attempt %s); sleeping %.1fs", attempt + 1, wait)
                        time.sleep(wait)
                        continue
                    raise
            if last_exc is not None:
                raise last_exc
            assert output is not None

            result_bytes = self._resolve_output(output, client)
            return BackgroundRemovalResult(
                image_bytes=result_bytes,
                content_type="image/png",
                provider_job_id=None,
                provider="replicate",
            )
        except AppError:
            raise
        except ReplicateError as exc:
            status = getattr(exc, "status", None) or getattr(exc, "status_code", None)
            try:
                status_i = int(status) if status is not None else None
            except (TypeError, ValueError):
                status_i = None
            detail = str(exc)
            if status_i == 402 or "Insufficient credit" in detail:
                raise AppError(
                    "Replicate account has no credit. Add billing at replicate.com/account/billing",
                    code="ai_insufficient_credit",
                    status_code=402,
                ) from exc
            if status_i == 429 or "throttled" in detail.lower() or "rate limit" in detail.lower():
                raise AppError(
                    "AI provider is rate-limited. Wait a few seconds and try again (or add ≥$5 Replicate credit).",
                    code="ai_rate_limited",
                    status_code=429,
                ) from exc
            logger.exception("Replicate background removal failed")
            raise AppError(
                "AI processing failed. Please try again.",
                code="ai_provider_error",
                status_code=502,
            ) from exc
        except Exception as exc:
            logger.exception("Replicate background removal failed")
            raise AppError(
                "AI processing failed. Please try again.",
                code="ai_provider_error",
                status_code=502,
            ) from exc

    def _resolve_output(self, output, client) -> bytes:
        import httpx

        _ = client
        if output is None:
            raise AppError("Empty AI result", code="ai_provider_error", status_code=502)

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
            resp = httpx.get(url, timeout=120.0, follow_redirects=True)
            resp.raise_for_status()
            if resp.content:
                return resp.content

        if hasattr(output, "read"):
            data = output.read()
            if isinstance(data, bytes) and data:
                return data
            if data:
                return bytes(data)

        raise AppError("Unrecognized AI result format", code="ai_provider_error", status_code=502)


class AutoBackgroundRemovalProvider(BackgroundRemovalProvider):
    """Prefer remove.bg, then Replicate; fall back to local rembg."""

    def remove_background(self, image_bytes: bytes, content_type: str) -> BackgroundRemovalResult:
        settings = get_settings()

        if settings.REMOVEBG_API_KEY:
            try:
                return RemoveBgProvider().remove_background(image_bytes, content_type)
            except AppError as exc:
                if exc.code in (
                    "ai_insufficient_credit",
                    "ai_not_configured",
                    "ai_no_foreground",
                    "ai_provider_error",
                ):
                    logger.warning("remove.bg unavailable (%s); trying next provider", exc.code)
                else:
                    raise

        if settings.REPLICATE_API_TOKEN:
            try:
                return ReplicateBackgroundRemovalProvider().remove_background(image_bytes, content_type)
            except AppError as exc:
                if exc.code in ("ai_insufficient_credit", "ai_not_configured", "ai_provider_error"):
                    logger.warning("Replicate unavailable (%s); falling back to local rembg", exc.code)
                else:
                    raise

        return LocalRembgProvider().remove_background(image_bytes, content_type)


class AIService:
    def __init__(self, provider: Optional[BackgroundRemovalProvider] = None):
        self._provider = provider

    @property
    def background_removal(self) -> BackgroundRemovalProvider:
        if self._provider is None:
            mode = (get_settings().AI_BG_PROVIDER or "auto").lower()
            if mode in ("removebg", "remove.bg", "remove_bg"):
                self._provider = RemoveBgProvider()
            elif mode == "local":
                self._provider = LocalRembgProvider()
            elif mode == "replicate":
                self._provider = ReplicateBackgroundRemovalProvider()
            else:
                self._provider = AutoBackgroundRemovalProvider()
        return self._provider

    def remove_background(self, image_bytes: bytes, content_type: str) -> BackgroundRemovalResult:
        return self.background_removal.remove_background(image_bytes, content_type)


def get_ai_service() -> AIService:
    return AIService()
