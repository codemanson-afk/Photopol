"""Shared credit / subscription grant helpers for Stripe + Paddle webhooks."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import CreditTransactionType, Subscription, User
from app.services.credits import CreditService
from app.services.tool_registry import PLAN_ALLOWANCE


def upsert_subscription(
    db: Session,
    user: User,
    *,
    provider: str,
    plan_id: str,
    status: str,
    period_end: Optional[datetime] = None,
    stripe_customer_id: Optional[str] = None,
    stripe_subscription_id: Optional[str] = None,
    paddle_customer_id: Optional[str] = None,
    paddle_subscription_id: Optional[str] = None,
) -> Subscription:
    sub = None
    if provider == "stripe" and stripe_subscription_id:
        sub = (
            db.query(Subscription)
            .filter(Subscription.stripe_subscription_id == stripe_subscription_id)
            .first()
        )
    elif provider == "paddle" and paddle_subscription_id:
        sub = (
            db.query(Subscription)
            .filter(Subscription.paddle_subscription_id == paddle_subscription_id)
            .first()
        )
    if not sub:
        sub = (
            db.query(Subscription)
            .filter(Subscription.user_id == user.id, Subscription.provider == provider)
            .order_by(Subscription.created_at.desc())
            .first()
        )
    if not sub:
        sub = Subscription(id=uuid4(), user_id=user.id, provider=provider)
        db.add(sub)

    sub.provider = provider
    sub.plan_id = plan_id
    sub.status = status
    sub.current_period_end = period_end
    sub.monthly_credit_allowance = PLAN_ALLOWANCE.get(plan_id, 0)

    if provider == "stripe":
        sub.stripe_customer_id = stripe_customer_id or user.stripe_customer_id
        if stripe_subscription_id:
            sub.stripe_subscription_id = stripe_subscription_id
        if stripe_customer_id:
            user.stripe_customer_id = stripe_customer_id
    else:
        sub.paddle_customer_id = paddle_customer_id or user.paddle_customer_id
        if paddle_subscription_id:
            sub.paddle_subscription_id = paddle_subscription_id
        if paddle_customer_id:
            user.paddle_customer_id = paddle_customer_id

    user.plan_id = plan_id if status in ("active", "trialing") else "free"
    return sub


def grant_subscription_credits(
    db: Session,
    user: User,
    *,
    plan: str,
    reference_id: str,
    operation: str,
    note: str,
) -> None:
    allowance = PLAN_ALLOWANCE.get(plan, 0)
    if not allowance:
        return
    CreditService(db).credit(
        user,
        allowance,
        tx_type=CreditTransactionType.SUBSCRIPTION_GRANT,
        operation=operation,
        reference_id=reference_id,
        note=note,
    )


def grant_pack_credits(
    db: Session,
    user: User,
    *,
    quantity: int,
    reference_id: str,
    operation: str = "credit_pack_purchase",
) -> int:
    settings = get_settings()
    credits_to_add = quantity * settings.STRIPE_CREDITS_PER_PACK
    CreditService(db).credit(
        user,
        credits_to_add,
        tx_type=CreditTransactionType.PURCHASE,
        operation=operation,
        reference_id=reference_id,
        note=f"Purchased {quantity} credit pack(s)",
    )
    return credits_to_add
