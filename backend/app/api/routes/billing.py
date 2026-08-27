import json
import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

import stripe
from fastapi import APIRouter, Request
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, DbSession
from app.core.config import billing_providers, get_settings
from app.core.errors import AppError
from app.models import PaymentEvent, Subscription, User
from app.schemas import BillingProvidersOut, BillingStatusOut, CheckoutRequest, PortalOut
from app.services import paddle_billing as paddle
from app.services.billing_grants import (
    grant_pack_credits,
    grant_subscription_credits,
    upsert_subscription,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _stripe_price_for_plan(plan: str) -> str:
    settings = get_settings()
    if plan == "pro":
        return settings.STRIPE_PRICE_ID_PRO_MONTHLY
    if plan == "business":
        return settings.STRIPE_PRICE_ID_BUSINESS_MONTHLY
    raise AppError("Unknown plan", code="invalid_plan", status_code=400)


def _resolve_provider(requested: Optional[str]) -> str:
    providers = billing_providers()
    enabled = [name for name, on in providers.items() if on]
    if not enabled:
        raise AppError(
            "Billing is not configured. Enable Stripe and/or Paddle.",
            code="billing_not_configured",
            status_code=503,
        )
    if requested:
        name = requested.lower().strip()
        if name not in ("stripe", "paddle"):
            raise AppError("Invalid provider", code="invalid_provider", status_code=400)
        if not providers.get(name):
            raise AppError(
                f"{name} billing is disabled or not configured",
                code="provider_disabled",
                status_code=503,
            )
        return name
    if len(enabled) == 1:
        return enabled[0]
    raise AppError(
        "Choose a payment provider (stripe or paddle)",
        code="provider_required",
        status_code=400,
    )


def _parse_user_id(data_obj: dict) -> Optional[UUID]:
    if data_obj.get("client_reference_id"):
        try:
            return UUID(data_obj["client_reference_id"])
        except Exception:
            pass
    meta = data_obj.get("metadata") or data_obj.get("custom_data") or {}
    if isinstance(meta, dict) and meta.get("user_id"):
        try:
            return UUID(str(meta["user_id"]))
        except Exception:
            pass
    return None


def _record_event(
    db: Session,
    *,
    provider: str,
    event_id: str,
    event_type: str,
    payload: dict,
    user_id: Optional[UUID],
) -> Optional[PaymentEvent]:
    existing = (
        db.query(PaymentEvent)
        .filter(
            PaymentEvent.provider == provider,
            PaymentEvent.external_event_id == event_id,
        )
        .first()
    )
    if existing:
        return None
    pe = PaymentEvent(
        user_id=user_id,
        provider=provider,
        external_event_id=event_id,
        event_type=event_type,
        payload=payload,
        processed=False,
    )
    db.add(pe)
    db.flush()
    return pe


@router.get("/status", response_model=BillingStatusOut)
def billing_status(user: CurrentUser, db: DbSession):
    sub = (
        db.query(Subscription)
        .filter(Subscription.user_id == user.id)
        .order_by(Subscription.created_at.desc())
        .first()
    )
    reserved = getattr(user, "reserved_credits", 0) or 0
    plan = "free"
    status = "inactive"
    period_end = None
    billing_provider = None
    if sub and sub.status in ("active", "trialing", "past_due"):
        plan = sub.plan_id
        status = sub.status
        period_end = sub.current_period_end
        billing_provider = getattr(sub, "provider", None) or "stripe"
    elif getattr(user, "plan_id", None):
        plan = user.plan_id
    providers = billing_providers()
    return BillingStatusOut(
        plan_id=plan,
        status=status,
        credit_balance=user.credit_balance,
        reserved_credits=reserved,
        available_credits=max(0, user.credit_balance - reserved),
        current_period_end=period_end,
        providers=BillingProvidersOut(**providers),
        billing_provider=billing_provider,
    )


def _stripe_checkout(body: CheckoutRequest, user: User, db: Session) -> dict:
    settings = get_settings()
    stripe.api_key = settings.STRIPE_SECRET_KEY
    mode = (body.mode or "payment").lower()

    try:
        customer_id = user.stripe_customer_id
        if not customer_id:
            customer = stripe.Customer.create(email=user.email, metadata={"user_id": str(user.id)})
            customer_id = customer.id
            user.stripe_customer_id = customer_id
            db.commit()

        if mode == "subscription":
            plan = (body.plan or "pro").lower()
            price_id = _stripe_price_for_plan(plan)
            if not price_id:
                raise AppError(
                    f"Set STRIPE_PRICE_ID_{plan.upper()}_MONTHLY",
                    code="billing_not_configured",
                    status_code=503,
                )
            session = stripe.checkout.Session.create(
                mode="subscription",
                customer=customer_id,
                line_items=[{"price": price_id, "quantity": 1}],
                success_url=settings.STRIPE_SUCCESS_URL,
                cancel_url=settings.STRIPE_CANCEL_URL,
                client_reference_id=str(user.id),
                metadata={"user_id": str(user.id), "plan": plan, "kind": "subscription"},
            )
        else:
            if not settings.STRIPE_PRICE_ID_CREDITS:
                raise AppError(
                    "Set STRIPE_PRICE_ID_CREDITS",
                    code="billing_not_configured",
                    status_code=503,
                )
            session = stripe.checkout.Session.create(
                mode="payment",
                customer=customer_id,
                line_items=[{"price": settings.STRIPE_PRICE_ID_CREDITS, "quantity": body.quantity}],
                success_url=settings.STRIPE_SUCCESS_URL,
                cancel_url=settings.STRIPE_CANCEL_URL,
                client_reference_id=str(user.id),
                metadata={
                    "user_id": str(user.id),
                    "quantity": str(body.quantity),
                    "kind": "credits",
                },
            )
        return {"checkout_url": session.url, "session_id": session.id, "provider": "stripe"}
    except AppError:
        raise
    except stripe.error.StripeError as exc:
        logger.exception("Stripe checkout failed")
        raise AppError("Unable to start checkout", code="stripe_error", status_code=502) from exc


def _paddle_checkout(body: CheckoutRequest, user: User, db: Session) -> dict:
    settings = get_settings()
    mode = (body.mode or "payment").lower()
    client = paddle.PaddleClient(settings)

    customer_id = client.ensure_customer(
        email=user.email, user_id=user.id, existing_id=user.paddle_customer_id
    )
    if customer_id != user.paddle_customer_id:
        user.paddle_customer_id = customer_id
        db.commit()

    if mode == "subscription":
        plan = (body.plan or "pro").lower()
        price_id = paddle.price_for_plan(plan, settings)
        if not price_id:
            raise AppError(
                f"Set PADDLE_PRICE_ID_{plan.upper()}_MONTHLY",
                code="billing_not_configured",
                status_code=503,
            )
        result = client.create_checkout(
            customer_id=customer_id,
            price_id=price_id,
            quantity=1,
            custom_data={
                "user_id": str(user.id),
                "plan": plan,
                "kind": "subscription",
            },
        )
    else:
        if not settings.PADDLE_PRICE_ID_CREDITS:
            raise AppError(
                "Set PADDLE_PRICE_ID_CREDITS",
                code="billing_not_configured",
                status_code=503,
            )
        result = client.create_checkout(
            customer_id=customer_id,
            price_id=settings.PADDLE_PRICE_ID_CREDITS,
            quantity=body.quantity,
            custom_data={
                "user_id": str(user.id),
                "quantity": str(body.quantity),
                "kind": "credits",
            },
        )
    result["provider"] = "paddle"
    return result


@router.post("/checkout")
def create_checkout(body: CheckoutRequest, user: CurrentUser, db: DbSession):
    provider = _resolve_provider(body.provider)
    if provider == "stripe":
        return _stripe_checkout(body, user, db)
    return _paddle_checkout(body, user, db)


@router.post("/portal", response_model=PortalOut)
def create_portal(user: CurrentUser, db: DbSession):
    settings = get_settings()
    sub = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == user.id,
            Subscription.status.in_(("active", "trialing", "past_due")),
        )
        .order_by(Subscription.created_at.desc())
        .first()
    )
    provider = (sub.provider if sub else None) or (
        "paddle" if user.paddle_customer_id and not user.stripe_customer_id else "stripe"
    )

    if provider == "paddle":
        if not billing_providers().get("paddle"):
            raise AppError("Paddle billing is not configured", code="billing_not_configured", status_code=503)
        customer_id = user.paddle_customer_id or (sub.paddle_customer_id if sub else None)
        if not customer_id:
            raise AppError("No Paddle customer yet", code="no_customer", status_code=400)
        client = paddle.PaddleClient(settings)
        url = client.create_portal_url(
            customer_id=customer_id,
            subscription_id=sub.paddle_subscription_id if sub else None,
        )
        return PortalOut(portal_url=url)

    if not billing_providers().get("stripe"):
        raise AppError("Stripe billing is not configured", code="billing_not_configured", status_code=503)
    if not user.stripe_customer_id:
        raise AppError("No billing customer yet", code="no_customer", status_code=400)
    stripe.api_key = settings.STRIPE_SECRET_KEY
    try:
        session = stripe.billing_portal.Session.create(
            customer=user.stripe_customer_id,
            return_url=settings.STRIPE_PORTAL_RETURN_URL,
        )
        return PortalOut(portal_url=session.url)
    except stripe.error.StripeError as exc:
        logger.exception("Stripe portal failed")
        raise AppError("Unable to open portal", code="stripe_error", status_code=502) from exc


async def _handle_stripe_webhook(request: Request, db: DbSession):
    settings = get_settings()
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    if not settings.STRIPE_WEBHOOK_SECRET:
        raise AppError("Webhook not configured", code="billing_not_configured", status_code=503)

    stripe.api_key = settings.STRIPE_SECRET_KEY
    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.STRIPE_WEBHOOK_SECRET)
    except Exception as exc:
        logger.warning("Stripe webhook signature verification failed")
        raise AppError("Invalid webhook signature", code="invalid_webhook", status_code=400) from exc

    data_obj = event["data"]["object"]
    user_id = _parse_user_id(data_obj)
    pe = _record_event(
        db,
        provider="stripe",
        event_id=event["id"],
        event_type=event["type"],
        payload=dict(event),
        user_id=user_id,
    )
    if pe is None:
        return {"status": "already_processed"}

    et = event["type"]

    if et == "checkout.session.completed" and user_id:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            meta = data_obj.get("metadata") or {}
            kind = meta.get("kind") or (
                "subscription" if data_obj.get("mode") == "subscription" else "credits"
            )
            if kind == "subscription" or data_obj.get("mode") == "subscription":
                plan = meta.get("plan") or "pro"
                sub_id = data_obj.get("subscription")
                upsert_subscription(
                    db,
                    user,
                    provider="stripe",
                    plan_id=plan,
                    status="active",
                    stripe_customer_id=data_obj.get("customer"),
                    stripe_subscription_id=str(sub_id) if sub_id else None,
                    period_end=None,
                )
                grant_subscription_credits(
                    db,
                    user,
                    plan=plan,
                    reference_id=event["id"],
                    operation="subscription_start",
                    note=f"{plan} subscription started",
                )
            else:
                qty = int(meta.get("quantity", "1") or 1)
                grant_pack_credits(
                    db,
                    user,
                    quantity=qty,
                    reference_id=event["id"],
                    operation="stripe_purchase",
                )
            pe.processed = True

    elif et == "invoice.paid":
        sub_id = data_obj.get("subscription")
        customer = data_obj.get("customer")
        user = None
        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
        if not user and customer:
            user = db.query(User).filter(User.stripe_customer_id == customer).first()
        if user and sub_id:
            sub = (
                db.query(Subscription)
                .filter(Subscription.stripe_subscription_id == str(sub_id))
                .first()
            )
            plan = sub.plan_id if sub else user.plan_id or "pro"
            billing_reason = data_obj.get("billing_reason")
            if billing_reason != "subscription_create":
                grant_subscription_credits(
                    db,
                    user,
                    plan=plan,
                    reference_id=event["id"],
                    operation="subscription_renewal",
                    note=f"Monthly {plan} credits",
                )
            pe.processed = True
            pe.user_id = user.id

    elif et in ("customer.subscription.updated", "customer.subscription.deleted"):
        customer = data_obj.get("customer")
        sub_id = data_obj.get("id")
        user = None
        if customer:
            user = db.query(User).filter(User.stripe_customer_id == customer).first()
        if user:
            status = data_obj.get("status") or "canceled"
            if et == "customer.subscription.deleted":
                status = "canceled"
            plan = user.plan_id or "pro"
            items = (data_obj.get("items") or {}).get("data") or []
            if items:
                price_id = (items[0].get("price") or {}).get("id")
                if price_id == settings.STRIPE_PRICE_ID_BUSINESS_MONTHLY:
                    plan = "business"
                elif price_id == settings.STRIPE_PRICE_ID_PRO_MONTHLY:
                    plan = "pro"
            period_end = None
            cpe = data_obj.get("current_period_end")
            if cpe:
                period_end = datetime.fromtimestamp(int(cpe), tz=timezone.utc)
            upsert_subscription(
                db,
                user,
                provider="stripe",
                plan_id=plan if status in ("active", "trialing", "past_due") else "free",
                status=status,
                stripe_customer_id=str(customer) if customer else None,
                stripe_subscription_id=str(sub_id) if sub_id else None,
                period_end=period_end,
            )
            pe.processed = True
            pe.user_id = user.id

    elif et == "invoice.payment_failed":
        customer = data_obj.get("customer")
        user = db.query(User).filter(User.stripe_customer_id == customer).first() if customer else None
        if user:
            sub = (
                db.query(Subscription)
                .filter(Subscription.user_id == user.id, Subscription.provider == "stripe")
                .order_by(Subscription.created_at.desc())
                .first()
            )
            if sub:
                sub.status = "past_due"
            pe.processed = True
            pe.user_id = user.id

    db.commit()
    return {"status": "ok"}


def _paddle_custom_data(data_obj: dict) -> dict:
    raw = data_obj.get("custom_data") or {}
    return raw if isinstance(raw, dict) else {}


def _paddle_first_price_id(data_obj: dict) -> Optional[str]:
    items = data_obj.get("items") or []
    if not items:
        return None
    price = items[0].get("price") if isinstance(items[0], dict) else None
    if isinstance(price, dict):
        return price.get("id")
    return items[0].get("price_id") if isinstance(items[0], dict) else None


async def _handle_paddle_webhook(request: Request, db: DbSession):
    settings = get_settings()
    payload = await request.body()
    sig = request.headers.get("paddle-signature", "") or request.headers.get("Paddle-Signature", "")

    if not settings.PADDLE_WEBHOOK_SECRET:
        raise AppError("Paddle webhook not configured", code="billing_not_configured", status_code=503)

    if not paddle.verify_webhook_signature(payload, sig, settings.PADDLE_WEBHOOK_SECRET):
        logger.warning("Paddle webhook signature verification failed")
        raise AppError("Invalid webhook signature", code="invalid_webhook", status_code=400)

    try:
        event = json.loads(payload.decode("utf-8"))
    except Exception as exc:
        raise AppError("Invalid webhook payload", code="invalid_webhook", status_code=400) from exc

    event_id = str(event.get("event_id") or event.get("notification_id") or "")
    event_type = str(event.get("event_type") or "")
    data_obj = event.get("data") or {}
    if not event_id:
        raise AppError("Missing event id", code="invalid_webhook", status_code=400)

    custom = _paddle_custom_data(data_obj)
    user_id = _parse_user_id({"custom_data": custom, "metadata": custom})
    pe = _record_event(
        db,
        provider="paddle",
        event_id=event_id,
        event_type=event_type,
        payload=event,
        user_id=user_id,
    )
    if pe is None:
        return {"status": "already_processed"}

    customer_id = data_obj.get("customer_id")
    if not user_id and customer_id:
        user = db.query(User).filter(User.paddle_customer_id == customer_id).first()
        user_id = user.id if user else None

    if event_type == "transaction.completed":
        user = db.query(User).filter(User.id == user_id).first() if user_id else None
        if user:
            kind = custom.get("kind")
            if not kind:
                kind = "subscription" if data_obj.get("subscription_id") else "credits"
            if kind == "subscription":
                plan = custom.get("plan") or paddle.plan_from_price_id(
                    _paddle_first_price_id(data_obj), settings
                )
                sub_id = data_obj.get("subscription_id")
                existing_sub = None
                if sub_id:
                    existing_sub = (
                        db.query(Subscription)
                        .filter(Subscription.paddle_subscription_id == str(sub_id))
                        .first()
                    )
                upsert_subscription(
                    db,
                    user,
                    provider="paddle",
                    plan_id=plan,
                    status="active",
                    paddle_customer_id=customer_id,
                    paddle_subscription_id=str(sub_id) if sub_id else None,
                )
                grant_subscription_credits(
                    db,
                    user,
                    plan=plan,
                    reference_id=event_id,
                    operation="subscription_renewal" if existing_sub else "subscription_start",
                    note=f"{'Monthly ' if existing_sub else ''}{plan} credits"
                    if existing_sub
                    else f"{plan} subscription started",
                )
            else:
                qty = int(custom.get("quantity", "1") or 1)
                grant_pack_credits(
                    db,
                    user,
                    quantity=qty,
                    reference_id=event_id,
                    operation="paddle_purchase",
                )
            pe.processed = True
            pe.user_id = user.id

    elif event_type in (
        "subscription.activated",
        "subscription.created",
        "subscription.updated",
        "subscription.canceled",
        "subscription.past_due",
    ):
        sub_id = data_obj.get("id")
        user = None
        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
        if not user and customer_id:
            user = db.query(User).filter(User.paddle_customer_id == customer_id).first()
        if user:
            status = data_obj.get("status") or "active"
            if event_type == "subscription.canceled":
                status = "canceled"
            elif event_type == "subscription.past_due":
                status = "past_due"
            plan = paddle.plan_from_price_id(_paddle_first_price_id(data_obj), settings)
            if status not in ("active", "trialing", "past_due"):
                plan_out = "free"
            else:
                plan_out = plan
            period_end = None
            cpe = data_obj.get("current_billing_period") or {}
            ends = cpe.get("ends_at") if isinstance(cpe, dict) else None
            if ends:
                try:
                    period_end = datetime.fromisoformat(str(ends).replace("Z", "+00:00"))
                except Exception:
                    period_end = None
            upsert_subscription(
                db,
                user,
                provider="paddle",
                plan_id=plan_out,
                status=status,
                paddle_customer_id=str(customer_id) if customer_id else None,
                paddle_subscription_id=str(sub_id) if sub_id else None,
                period_end=period_end,
            )
            # Renewal credit on subscription.updated when billed again is tricky;
            # grant on transaction.completed for renewals when kind=subscription.
            pe.processed = True
            pe.user_id = user.id

    elif event_type == "transaction.payment_failed":
        user = None
        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
        if not user and customer_id:
            user = db.query(User).filter(User.paddle_customer_id == customer_id).first()
        if user:
            sub = (
                db.query(Subscription)
                .filter(Subscription.user_id == user.id, Subscription.provider == "paddle")
                .order_by(Subscription.created_at.desc())
                .first()
            )
            if sub:
                sub.status = "past_due"
            pe.processed = True
            pe.user_id = user.id

    db.commit()
    return {"status": "ok"}


@router.post("/webhook")
async def stripe_webhook(request: Request, db: DbSession):
    return await _handle_stripe_webhook(request, db)


@router.post("/webhook/stripe")
async def stripe_webhook_alias(request: Request, db: DbSession):
    return await _handle_stripe_webhook(request, db)


@router.post("/webhook/paddle")
async def paddle_webhook(request: Request, db: DbSession):
    return await _handle_paddle_webhook(request, db)
