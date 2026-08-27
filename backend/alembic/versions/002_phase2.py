"""Phase 2 — jobs, credits hold, subscriptions

Revision ID: 002_phase2
Revises: 001_initial
Create Date: 2026-08-23
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002_phase2"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == "postgresql":
        for value in ("OBJECT_REMOVE", "UPSCALE", "BG_REPLACE", "ENHANCE", "BATCH"):
            op.execute(sa.text(f"ALTER TYPE jobtype ADD VALUE IF NOT EXISTS '{value}'"))
        for value in ("QUEUED", "CANCELLED"):
            op.execute(sa.text(f"ALTER TYPE jobstatus ADD VALUE IF NOT EXISTS '{value}'"))
        op.execute(
            sa.text("ALTER TYPE credittransactiontype ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_GRANT'")
        )

    op.add_column(
        "users",
        sa.Column("reserved_credits", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("users", sa.Column("stripe_customer_id", sa.String(255), nullable=True))
    op.add_column(
        "users",
        sa.Column("plan_id", sa.String(50), nullable=False, server_default="free"),
    )

    op.add_column("processing_jobs", sa.Column("model_id", sa.String(100), nullable=True))
    op.add_column(
        "processing_jobs",
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "processing_jobs",
        sa.Column("priority", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "processing_jobs",
        sa.Column("batch_id", postgresql.UUID(as_uuid=True), nullable=True)
        if dialect == "postgresql"
        else sa.Column("batch_id", sa.String(36), nullable=True),
    )
    op.add_column(
        "processing_jobs",
        sa.Column("credits_held", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column("processing_jobs", sa.Column("error_code", sa.String(64), nullable=True))
    op.add_column(
        "processing_jobs",
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("processing_jobs", sa.Column("tool", sa.String(50), nullable=True))

    id_col = (
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True)
        if dialect == "postgresql"
        else sa.Column("id", sa.String(36), primary_key=True)
    )
    user_fk = (
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        )
        if dialect == "postgresql"
        else sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        )
    )

    op.create_table(
        "subscriptions",
        id_col,
        user_fk,
        sa.Column("stripe_customer_id", sa.String(255), nullable=True),
        sa.Column("stripe_subscription_id", sa.String(255), nullable=True),
        sa.Column("plan_id", sa.String(50), nullable=False, server_default="free"),
        sa.Column("status", sa.String(50), nullable=False, server_default="inactive"),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "monthly_credit_allowance",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("stripe_subscription_id", name="uq_subscriptions_stripe_sub"),
    )
    op.create_index("ix_subscriptions_user_id", "subscriptions", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_subscriptions_user_id", table_name="subscriptions")
    op.drop_table("subscriptions")
    op.drop_column("processing_jobs", "tool")
    op.drop_column("processing_jobs", "started_at")
    op.drop_column("processing_jobs", "error_code")
    op.drop_column("processing_jobs", "credits_held")
    op.drop_column("processing_jobs", "batch_id")
    op.drop_column("processing_jobs", "priority")
    op.drop_column("processing_jobs", "progress")
    op.drop_column("processing_jobs", "model_id")
    op.drop_column("users", "plan_id")
    op.drop_column("users", "stripe_customer_id")
    op.drop_column("users", "reserved_credits")
