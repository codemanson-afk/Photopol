from fastapi import APIRouter
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, DbSession
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import create_access_token, hash_password, verify_password
from app.models import CreditTransactionType, User, UserRole
from app.schemas import LoginRequest, MessageOut, RegisterRequest, TokenResponse, UserOut
from app.services.credits import CreditService

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
def register(body: RegisterRequest, db: DbSession):
    existing = db.query(User).filter(User.email == body.email.lower()).first()
    if existing:
        raise AppError("Email already registered", code="duplicate_email", status_code=409)

    settings = get_settings()
    user = User(
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        full_name=body.full_name.strip(),
        role=UserRole.USER,
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
        note="Welcome bonus credits",
    )
    db.commit()
    token = create_access_token(str(user.id), extra={"role": user.role.value})
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: DbSession):
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise AppError("Invalid email or password", code="invalid_credentials", status_code=401)
    if not user.is_active:
        raise AppError("Account is inactive", code="inactive", status_code=403)
    token = create_access_token(str(user.id), extra={"role": user.role.value})
    return TokenResponse(access_token=token)


@router.post("/logout", response_model=MessageOut)
def logout(user: CurrentUser):
    # JWT is stateless; client discards token
    return MessageOut(message="Logged out")


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        credit_balance=user.credit_balance,
        is_active=user.is_active,
        created_at=user.created_at,
    )
