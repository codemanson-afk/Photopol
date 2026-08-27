from dataclasses import dataclass
from typing import Annotated, Optional
from uuid import UUID
import uuid

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import AppError
from app.core.security import decode_access_token
from app.models import GuestSession, User, UserRole

security = HTTPBearer(auto_error=False)


@dataclass
class Actor:
    user: User
    guest_session: Optional[GuestSession] = None

    @property
    def is_guest(self) -> bool:
        return self.guest_session is not None and self.guest_session.claimed_user_id is None


def get_current_user(
    db: Annotated[Session, Depends(get_db)],
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
) -> User:
    actor = resolve_actor(db, credentials, allow_guest=False)
    return actor.user


def get_current_admin(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user.role != UserRole.ADMIN:
        raise AppError("Admin access required", code="forbidden", status_code=403)
    return user


def get_actor(
    db: Annotated[Session, Depends(get_db)],
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
) -> Actor:
    return resolve_actor(db, credentials, allow_guest=True)


def resolve_actor(
    db: Session,
    credentials: Optional[HTTPAuthorizationCredentials],
    *,
    allow_guest: bool,
) -> Actor:
    if not credentials or not credentials.credentials:
        raise AppError("Not authenticated", code="unauthorized", status_code=401)
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("missing sub")
        uid = uuid.UUID(str(user_id))
        typ = payload.get("typ", "user")
    except Exception as exc:
        raise AppError("Invalid or expired token", code="unauthorized", status_code=401) from exc

    user = db.query(User).filter(User.id == uid).first()
    if not user or not user.is_active:
        raise AppError("User not found or inactive", code="unauthorized", status_code=401)

    if typ == "guest":
        if not allow_guest:
            raise AppError("Sign in required", code="unauthorized", status_code=401)
        gid = payload.get("gid")
        session = None
        if gid:
            try:
                session = db.query(GuestSession).filter(GuestSession.id == UUID(str(gid))).first()
            except Exception:
                session = None
        if not session:
            session = db.query(GuestSession).filter(GuestSession.user_id == user.id).first()
        if not session or session.claimed_user_id is not None:
            raise AppError("Guest session expired", code="unauthorized", status_code=401)
        if not user.is_guest:
            raise AppError("Invalid guest token", code="unauthorized", status_code=401)
        return Actor(user=user, guest_session=session)

    if user.is_guest:
        raise AppError("Sign in required", code="unauthorized", status_code=401)
    return Actor(user=user, guest_session=None)


CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(get_current_admin)]
CurrentActor = Annotated[Actor, Depends(get_actor)]
DbSession = Annotated[Session, Depends(get_db)]
