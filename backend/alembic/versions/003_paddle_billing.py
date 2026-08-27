"""Phase 3 — Paddle + dual provider billing

Revision ID: 003_paddle_billing
Revises: 002_phase2
Create Date: 2026-08-23
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_paddle_billing"
down_revision: Union[str, None] = "002_phase2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("paddle_customer_id", sa.String(255), nullable=True))

    op.add_column(
        "subscriptions",
        sa.Column("provider", sa.String(32), nullable=False, server_default="stripe"),
    )
    op.add_column("subscriptions", sa.Column("paddle_customer_id", sa.String(255), nullable=True))
    op.add_column("subscriptions", sa.Column("paddle_subscription_id", sa.String(255), nullable=True))
    op.create_unique_constraint(
        "uq_subscriptions_paddle_sub", "subscriptions", ["paddle_subscription_id"]
    )

    op.add_column(
        "payment_events",
        sa.Column("provider", sa.String(32), nullable=False, server_default="stripe"),
    )
    op.add_column("payment_events", sa.Column("external_event_id", sa.String(255), nullable=True))
    op.execute(
        sa.text("UPDATE payment_events SET external_event_id = stripe_event_id WHERE external_event_id IS NULL")
    )

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for uc in inspector.get_unique_constraints("payment_events"):
        cols = set(uc.get("column_names") or [])
        if "stripe_event_id" in cols:
            op.drop_constraint(uc["name"], "payment_events", type_="unique")

    op.drop_column("payment_events", "stripe_event_id")
    op.alter_column("payment_events", "external_event_id", nullable=False)
    op.create_unique_constraint(
        "uq_payment_events_provider_event",
        "payment_events",
        ["provider", "external_event_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_payment_events_provider_event", "payment_events", type_="unique")
    op.add_column("payment_events", sa.Column("stripe_event_id", sa.String(255), nullable=True))
    op.execute(sa.text("UPDATE payment_events SET stripe_event_id = external_event_id"))
    op.alter_column("payment_events", "stripe_event_id", nullable=False)
    op.create_unique_constraint(
        "payment_events_stripe_event_id_key", "payment_events", ["stripe_event_id"]
    )
    op.drop_column("payment_events", "external_event_id")
    op.drop_column("payment_events", "provider")

    op.drop_constraint("uq_subscriptions_paddle_sub", "subscriptions", type_="unique")
    op.drop_column("subscriptions", "paddle_subscription_id")
    op.drop_column("subscriptions", "paddle_customer_id")
    op.drop_column("subscriptions", "provider")

    op.drop_column("users", "paddle_customer_id")
