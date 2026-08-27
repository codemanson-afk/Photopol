import secrets
import uuid
from typing import Optional
from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.deps import CurrentUser, DbSession
from app.core.errors import AppError
from app.core.security import create_access_token, decode_access_token, hash_password
from app.models import GuestSession, Image, ProcessingJob, Project, User, UserRole

router = APIRouter()


class ClaimRequest(BaseModel):
    guest_token: Optional[str] = None
    session_id: Optional[str] = None


@router.post("/session")
def create_guest_session(db: DbSession):
    guest_id = uuid.uuid4()
    user = User(
        id=guest_id,
        email=f"guest-{guest_id.hex}@guest.local",
        password_hash=hash_password(secrets.token_urlsafe(24)),
        full_name="Guest",
        role=UserRole.USER,
        credit_balance=0,
        is_active=True,
        is_guest=True,
    )
    db.add(user)
    db.flush()
    session = GuestSession(id=uuid.uuid4(), user_id=user.id, image_count=0, job_count=0)
    db.add(session)
    db.commit()
    token = create_access_token(
        str(user.id),
        extra={"typ": "guest", "gid": str(session.id), "role": "GUEST"},
    )
    return {"guest_token": token, "session_id": str(session.id)}


@router.post("/claim")
def claim_guest_session(body: ClaimRequest, user: CurrentUser, db: DbSession):
    if user.is_guest:
        raise AppError("Invalid account", code="forbidden", status_code=403)

    session: GuestSession | None = None
    if body.session_id:
        try:
            session = db.query(GuestSession).filter(GuestSession.id == UUID(body.session_id)).first()
        except Exception:
            session = None
    elif body.guest_token:
        try:
            data = decode_access_token(body.guest_token)
            gid = data.get("gid")
            if gid:
                session = db.query(GuestSession).filter(GuestSession.id == UUID(str(gid))).first()
            elif data.get("sub"):
                session = (
                    db.query(GuestSession)
                    .filter(GuestSession.user_id == UUID(str(data["sub"])))
                    .first()
                )
        except Exception:
            session = None

    if not session:
        raise AppError("Guest session not found", code="not_found", status_code=404)
    if session.claimed_user_id is not None:
        return {
            "message": "Already claimed",
            "project_id": str(session.project_id) if session.project_id else None,
        }

    guest_user_id = session.user_id
    db.query(Project).filter(Project.user_id == guest_user_id).update(
        {"user_id": user.id}, synchronize_session=False
    )
    db.query(Image).filter(Image.user_id == guest_user_id).update(
        {"user_id": user.id}, synchronize_session=False
    )
    db.query(ProcessingJob).filter(ProcessingJob.user_id == guest_user_id).update(
        {"user_id": user.id}, synchronize_session=False
    )
    session.claimed_user_id = user.id
    guest = db.query(User).filter(User.id == guest_user_id).first()
    if guest:
        guest.is_active = False
    db.commit()
    return {
        "message": "Claimed",
        "project_id": str(session.project_id) if session.project_id else None,
    }
