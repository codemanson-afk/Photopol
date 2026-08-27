"""Create an admin user. Usage: python -m scripts.create_admin email password "Full Name"
"""
import sys
import uuid

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import CreditTransactionType, User, UserRole
from app.core.config import get_settings
from app.services.credits import CreditService


def main() -> None:
    if len(sys.argv) < 4:
        print("Usage: python -m scripts.create_admin <email> <password> <full_name>")
        sys.exit(1)
    email, password, full_name = sys.argv[1], sys.argv[2], sys.argv[3]
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email.lower()).first()
        if existing:
            existing.role = UserRole.ADMIN
            existing.password_hash = hash_password(password)
            existing.full_name = full_name
            db.commit()
            print(f"Updated existing user to ADMIN: {email}")
            return
        settings = get_settings()
        user = User(
            id=uuid.uuid4(),
            email=email.lower(),
            password_hash=hash_password(password),
            full_name=full_name,
            role=UserRole.ADMIN,
            credit_balance=0,
            is_active=True,
        )
        db.add(user)
        db.flush()
        CreditService(db).credit(
            user,
            settings.INITIAL_CREDITS,
            tx_type=CreditTransactionType.SIGNUP_BONUS,
            operation="signup",
            reference_id=f"signup-{user.id}",
            note="Admin welcome credits",
        )
        db.commit()
        print(f"Created ADMIN user: {email}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
