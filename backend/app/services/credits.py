import logging
import uuid
from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import CreditTransaction, CreditTransactionType, User

logger = logging.getLogger(__name__)


class CreditService:
    def __init__(self, db: Session):
        self.db = db

    def ensure_balance(self, user: User, cost: int) -> None:
        if cost < 0:
            raise AppError("Invalid credit cost", code="invalid_cost")
        available = user.credit_balance - getattr(user, "reserved_credits", 0)
        if available < cost:
            raise AppError(
                "Insufficient credits",
                code="insufficient_credits",
                status_code=402,
            )

    def reserve(self, user: User, amount: int) -> None:
        """Hold credits until job settles or fails."""
        if amount <= 0:
            return
        locked = (
            self.db.query(User)
            .filter(User.id == user.id)
            .with_for_update()
            .one()
        )
        available = locked.credit_balance - locked.reserved_credits
        if available < amount:
            raise AppError(
                "Insufficient credits",
                code="insufficient_credits",
                status_code=402,
            )
        locked.reserved_credits += amount
        user.reserved_credits = locked.reserved_credits
        self.db.flush()

    def release_reserve(self, user: User, amount: int) -> None:
        if amount <= 0:
            return
        locked = (
            self.db.query(User)
            .filter(User.id == user.id)
            .with_for_update()
            .one()
        )
        locked.reserved_credits = max(0, locked.reserved_credits - amount)
        user.reserved_credits = locked.reserved_credits
        self.db.flush()

    def deduct(
        self,
        user: User,
        amount: int,
        *,
        operation: str,
        reference_id: str,
        tx_type: CreditTransactionType = CreditTransactionType.AI_OPERATION,
        note: Optional[str] = None,
        release_hold: int = 0,
    ) -> CreditTransaction:
        """Deduct credits after success. Idempotent via reference_id + type unique constraint."""
        if amount <= 0:
            raise AppError("Deduct amount must be positive", code="invalid_amount")

        existing = (
            self.db.query(CreditTransaction)
            .filter(
                CreditTransaction.reference_id == reference_id,
                CreditTransaction.type == tx_type,
            )
            .first()
        )
        if existing:
            return existing

        # Lock user row for update
        locked = (
            self.db.query(User)
            .filter(User.id == user.id)
            .with_for_update()
            .one()
        )
        if release_hold > 0:
            locked.reserved_credits = max(0, locked.reserved_credits - release_hold)
        if locked.credit_balance < amount:
            raise AppError(
                "Insufficient credits",
                code="insufficient_credits",
                status_code=402,
            )

        locked.credit_balance -= amount
        tx = CreditTransaction(
            id=uuid.uuid4(),
            user_id=locked.id,
            amount=-amount,
            type=tx_type,
            operation=operation,
            reference_id=reference_id,
            balance_after=locked.credit_balance,
            note=note,
        )
        self.db.add(tx)
        try:
            self.db.flush()
        except IntegrityError:
            self.db.rollback()
            existing = (
                self.db.query(CreditTransaction)
                .filter(
                    CreditTransaction.reference_id == reference_id,
                    CreditTransaction.type == tx_type,
                )
                .first()
            )
            if existing:
                return existing
            raise
        user.credit_balance = locked.credit_balance
        user.reserved_credits = locked.reserved_credits
        return tx

    def credit(
        self,
        user: User,
        amount: int,
        *,
        tx_type: CreditTransactionType,
        operation: Optional[str] = None,
        reference_id: Optional[str] = None,
        note: Optional[str] = None,
    ) -> CreditTransaction:
        if amount == 0:
            raise AppError("Amount cannot be zero", code="invalid_amount")

        if reference_id:
            existing = (
                self.db.query(CreditTransaction)
                .filter(
                    CreditTransaction.reference_id == reference_id,
                    CreditTransaction.type == tx_type,
                )
                .first()
            )
            if existing:
                return existing

        locked = (
            self.db.query(User)
            .filter(User.id == user.id)
            .with_for_update()
            .one()
        )
        locked.credit_balance += amount
        if locked.credit_balance < 0:
            raise AppError("Resulting balance cannot be negative", code="invalid_balance")

        tx = CreditTransaction(
            id=uuid.uuid4(),
            user_id=locked.id,
            amount=amount,
            type=tx_type,
            operation=operation,
            reference_id=reference_id,
            balance_after=locked.credit_balance,
            note=note,
        )
        self.db.add(tx)
        self.db.flush()
        user.credit_balance = locked.credit_balance
        return tx
