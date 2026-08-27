"""Record admin mutations for the ops audit log."""

from __future__ import annotations

from typing import Any, Optional
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.models import AdminAuditLog


def record_admin_action(
    db: Session,
    *,
    actor_id: UUID,
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    payload: Optional[dict[str, Any]] = None,
) -> AdminAuditLog:
    row = AdminAuditLog(
        id=uuid4(),
        actor_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id is not None else None,
        payload=payload,
    )
    db.add(row)
    db.flush()
    return row
