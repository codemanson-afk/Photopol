"""Paddle Billing API (httpx) — checkout, portal, webhook verify."""

from __future__ import annotations

import hashlib
import hmac
import logging
from typing import Any, Optional
from uuid import UUID

import httpx

from app.core.config import Settings, get_settings
from app.core.errors import AppError

logger = logging.getLogger(__name__)


def paddle_api_base(settings: Optional[Settings] = None) -> str:
    s = settings or get_settings()
    if (s.PADDLE_ENV or "sandbox").lower() == "production":
        return "https://api.paddle.com"
    return "https://sandbox-api.paddle.com"


def price_for_plan(plan: str, settings: Optional[Settings] = None) -> str:
    s = settings or get_settings()
    if plan == "pro":
        return s.PADDLE_PRICE_ID_PRO_MONTHLY
    if plan == "business":
        return s.PADDLE_PRICE_ID_BUSINESS_MONTHLY
    raise AppError("Unknown plan", code="invalid_plan", status_code=400)


def plan_from_price_id(price_id: Optional[str], settings: Optional[Settings] = None) -> str:
    s = settings or get_settings()
    if not price_id:
        return "pro"
    if price_id == s.PADDLE_PRICE_ID_BUSINESS_MONTHLY:
        return "business"
    if price_id == s.PADDLE_PRICE_ID_PRO_MONTHLY:
        return "pro"
    return "pro"


def verify_webhook_signature(payload: bytes, signature_header: str, secret: str) -> bool:
    """Verify Paddle-Signature: ts=...;h1=..."""
    if not signature_header or not secret:
        return False
    parts: dict[str, str] = {}
    for item in signature_header.split(";"):
        if "=" in item:
            k, v = item.split("=", 1)
            parts[k.strip()] = v.strip()
    ts = parts.get("ts")
    h1 = parts.get("h1")
    if not ts or not h1:
        return False
    signed = f"{ts}:{payload.decode('utf-8')}".encode("utf-8")
    digest = hmac.new(secret.encode("utf-8"), signed, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, h1)


class PaddleClient:
    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()
        if not self.settings.PADDLE_API_KEY:
            raise AppError(
                "Paddle is not configured. Set PADDLE_API_KEY.",
                code="billing_not_configured",
                status_code=503,
            )

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.settings.PADDLE_API_KEY}",
            "Content-Type": "application/json",
        }

    def _request(self, method: str, path: str, json: Optional[dict] = None) -> dict[str, Any]:
        url = f"{paddle_api_base(self.settings)}{path}"
        try:
            with httpx.Client(timeout=30.0) as client:
                res = client.request(method, url, headers=self._headers(), json=json)
                data = res.json() if res.content else {}
                if res.status_code >= 400:
                    logger.error("Paddle API error %s %s: %s", method, path, data)
                    raise AppError(
                        "Paddle request failed",
                        code="paddle_error",
                        status_code=502,
                    )
                return data
        except AppError:
            raise
        except Exception as exc:
            logger.exception("Paddle API request failed")
            raise AppError("Paddle request failed", code="paddle_error", status_code=502) from exc

    def ensure_customer(self, *, email: str, user_id: UUID, existing_id: Optional[str]) -> str:
        if existing_id:
            return existing_id
        body = {
            "email": email,
            "custom_data": {"user_id": str(user_id)},
        }
        data = self._request("POST", "/customers", json=body)
        cid = (data.get("data") or {}).get("id")
        if not cid:
            raise AppError("Paddle customer create failed", code="paddle_error", status_code=502)
        return str(cid)

    def create_checkout(
        self,
        *,
        customer_id: str,
        price_id: str,
        quantity: int,
        custom_data: dict[str, str],
    ) -> dict[str, str]:
        body: dict[str, Any] = {
            "items": [{"price_id": price_id, "quantity": quantity}],
            "customer_id": customer_id,
            "custom_data": custom_data,
            "collection_mode": "automatic",
        }
        success = self.settings.paddle_success_url
        if success:
            body["checkout"] = {"url": success}

        data = self._request("POST", "/transactions", json=body)
        txn = data.get("data") or {}
        checkout = txn.get("checkout") or {}
        url = checkout.get("url")
        txn_id = txn.get("id")
        if not url:
            raise AppError(
                "Paddle checkout URL missing — set a default payment link in Paddle dashboard",
                code="paddle_error",
                status_code=502,
            )
        return {"checkout_url": url, "session_id": str(txn_id or "")}

    def create_portal_url(
        self, *, customer_id: str, subscription_id: Optional[str] = None
    ) -> str:
        body: dict[str, Any] = {}
        if subscription_id:
            body["subscription_ids"] = [subscription_id]
        data = self._request(
            "POST", f"/customers/{customer_id}/portal-sessions", json=body if body else {}
        )
        urls = (data.get("data") or {}).get("urls") or {}
        general = urls.get("general") or {}
        overview = general.get("overview")
        if overview:
            return str(overview)
        subs = urls.get("subscriptions") or []
        if subs and isinstance(subs[0], dict):
            # fall back to first deep link
            for key in ("update_subscription_payment_method", "cancel_subscription"):
                if subs[0].get(key):
                    return str(subs[0][key])
        raise AppError("Paddle portal URL missing", code="paddle_error", status_code=502)
