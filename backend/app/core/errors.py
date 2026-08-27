from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import HTTPException, status
from fastapi.responses import JSONResponse


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AppError(Exception):
    def __init__(
        self,
        message: str,
        *,
        code: str = "error",
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: Optional[Any] = None,
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details
        super().__init__(message)


def error_response(exc: AppError) -> JSONResponse:
    body: dict[str, Any] = {
        "error": {
            "code": exc.code,
            "message": exc.message,
        }
    }
    if exc.details is not None:
        body["error"]["details"] = exc.details
    return JSONResponse(status_code=exc.status_code, content=body)


def http_error(message: str, status_code: int = 400, code: str = "error") -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message},
    )
