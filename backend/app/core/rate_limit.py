"""Simple in-memory rate limiter for AI endpoints."""
from __future__ import annotations

import time
from collections import defaultdict, deque
from typing import Deque, Dict

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.config import get_settings

AI_PATH_SUFFIXES = (
    "/background-removal",
    "/resize",
    "/crop",
)


class AIRateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if request.method == "POST" and any(path.endswith(s) for s in AI_PATH_SUFFIXES):
            settings = get_settings()
            key = request.client.host if request.client else "unknown"
            auth = request.headers.get("authorization", "")
            if auth:
                key = auth[-32:]
            now = time.time()
            window = 60.0
            limit = settings.AI_RATE_LIMIT_PER_MINUTE
            q = self._hits[key]
            while q and now - q[0] > window:
                q.popleft()
            if len(q) >= limit:
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": {
                            "code": "rate_limit",
                            "message": "Too many AI requests. Please wait a minute.",
                        }
                    },
                )
            q.append(now)
        return await call_next(request)
