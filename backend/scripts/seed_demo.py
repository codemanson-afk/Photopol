"""Seed local demo user. Run: python -m scripts.seed_demo"""
import uuid

from app.core.config import get_settings
from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models import CreditTransaction, CreditTransactionType, User, UserRole
import app.models  # noqa: F401


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    email = "demo@photopol.us"
    password = "demo1234"
    try:
        user = db.query(User).filter(User.email == email).first()
        hashed = hash_password(password)
        if user:
            user.password_hash = hashed
            user.role = UserRole.ADMIN
            user.is_active = True
            if user.credit_balance < 50:
                user.credit_balance = 50
            db.commit()
            print(f"updated {email}")
        else:
            user = User(
                id=uuid.uuid4(),
                email=email,
                password_hash=hashed,
                full_name="Demo User",
                role=UserRole.ADMIN,
                credit_balance=get_settings().INITIAL_CREDITS,
                is_active=True,
            )
            db.add(user)
            db.flush()
            db.add(
                CreditTransaction(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    amount=get_settings().INITIAL_CREDITS,
                    type=CreditTransactionType.SIGNUP_BONUS,
                    operation="signup",
                    reference_id=f"signup-{user.id}",
                    balance_after=user.credit_balance,
                    note="Demo account",
                )
            )
            db.commit()
            print(f"created {email}")
        print(f"password: {password}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
