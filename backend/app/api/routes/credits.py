from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.models import CreditTransaction
from app.schemas import CreditTransactionOut

router = APIRouter()


@router.get("/balance")
def balance(user: CurrentUser):
    return {"credit_balance": user.credit_balance}


@router.get("/transactions", response_model=list[CreditTransactionOut])
def transactions(user: CurrentUser, db: DbSession):
    rows = (
        db.query(CreditTransaction)
        .filter(CreditTransaction.user_id == user.id)
        .order_by(CreditTransaction.created_at.desc())
        .limit(100)
        .all()
    )
    return [
        CreditTransactionOut(
            id=r.id,
            amount=r.amount,
            type=r.type.value,
            operation=r.operation,
            reference_id=r.reference_id,
            balance_after=r.balance_after,
            note=r.note,
            created_at=r.created_at,
        )
        for r in rows
    ]
