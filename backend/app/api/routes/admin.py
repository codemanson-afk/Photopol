"""Admin ops API — users, jobs, projects, credits, billing snapshot, audit."""

from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.api.deps import AdminUser, DbSession
from app.core.config import billing_providers
from app.core.errors import AppError
from app.models import (
    AdminAuditLog,
    CreditTransaction,
    CreditTransactionType,
    JobStatus,
    JobType,
    ProcessingJob,
    Project,
    Subscription,
    User,
    UserRole,
)
from app.schemas import (
    AdminAuditOut,
    AdminBillingOverview,
    AdminCreditAdjust,
    AdminCreditTxOut,
    AdminJobDetail,
    AdminPaginatedAudit,
    AdminPaginatedCredits,
    AdminPaginatedJobs,
    AdminPaginatedProjects,
    AdminPaginatedUsers,
    AdminProjectItem,
    AdminStats,
    AdminSubscriptionSummary,
    AdminUserDetail,
    AdminUserListItem,
    AdminUserPatch,
    BillingProvidersOut,
    UserOut,
)
from app.services.admin_audit import record_admin_action
from app.services.credits import CreditService

router = APIRouter()

ALLOWED_PLANS = {"free", "pro", "business"}


def _user_list_item(u: User) -> AdminUserListItem:
    return AdminUserListItem(
        id=u.id,
        email=u.email,
        full_name=u.full_name,
        role=u.role.value if hasattr(u.role, "value") else str(u.role),
        credit_balance=u.credit_balance,
        reserved_credits=getattr(u, "reserved_credits", 0) or 0,
        plan_id=getattr(u, "plan_id", None) or "free",
        is_active=u.is_active,
        is_guest=bool(getattr(u, "is_guest", False)),
        created_at=u.created_at,
    )


def _sub_summary(sub: Subscription) -> AdminSubscriptionSummary:
    return AdminSubscriptionSummary(
        id=sub.id,
        provider=getattr(sub, "provider", None) or "stripe",
        plan_id=sub.plan_id,
        status=sub.status,
        current_period_end=sub.current_period_end,
        monthly_credit_allowance=sub.monthly_credit_allowance or 0,
    )


def _job_detail(db: Session, j: ProcessingJob) -> AdminJobDetail:
    user = db.query(User).filter(User.id == j.user_id).first()
    project = db.query(Project).filter(Project.id == j.project_id).first()
    return AdminJobDetail(
        id=j.id,
        job_type=j.job_type.value if hasattr(j.job_type, "value") else str(j.job_type),
        tool=j.tool,
        model_id=j.model_id,
        status=j.status.value if hasattr(j.status, "value") else str(j.status),
        credit_cost=j.credit_cost,
        credits_deducted=j.credits_deducted,
        progress=j.progress or 0,
        error_message=j.error_message,
        error_code=j.error_code,
        result_version_id=j.result_version_id,
        created_at=j.created_at,
        completed_at=j.completed_at,
        user_id=j.user_id,
        project_id=j.project_id,
        image_id=j.image_id,
        provider=j.provider,
        user_email=user.email if user else None,
        project_name=project.name if project else None,
    )


def _admin_count(db: Session) -> int:
    return (
        db.query(func.count(User.id)).filter(User.role == UserRole.ADMIN, User.is_active.is_(True)).scalar()
        or 0
    )


@router.get("/stats", response_model=AdminStats)
def admin_stats(_: AdminUser, db: DbSession):
    total_users = db.query(func.count(User.id)).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.is_active.is_(True)).scalar() or 0
    paid_users = (
        db.query(func.count(User.id)).filter(User.plan_id.in_(("pro", "business"))).scalar() or 0
    )
    guest_users = db.query(func.count(User.id)).filter(User.is_guest.is_(True)).scalar() or 0
    images_processed = (
        db.query(func.count(ProcessingJob.id))
        .filter(ProcessingJob.status == JobStatus.COMPLETED)
        .scalar()
        or 0
    )
    processing_jobs = db.query(func.count(ProcessingJob.id)).scalar() or 0
    failed_jobs = (
        db.query(func.count(ProcessingJob.id))
        .filter(ProcessingJob.status == JobStatus.FAILED)
        .scalar()
        or 0
    )
    credit_usage = (
        db.query(func.coalesce(func.sum(-CreditTransaction.amount), 0))
        .filter(
            CreditTransaction.type == CreditTransactionType.AI_OPERATION,
            CreditTransaction.amount < 0,
        )
        .scalar()
        or 0
    )
    jobs_completed = int(images_processed)
    avg = float(credit_usage) / jobs_completed if jobs_completed else 0.0
    return AdminStats(
        total_users=int(total_users),
        images_processed=int(images_processed),
        processing_jobs=int(processing_jobs),
        failed_jobs=int(failed_jobs),
        credit_usage=int(credit_usage),
        credits_spent=int(credit_usage),
        jobs_completed=jobs_completed,
        avg_credits_per_job=round(avg, 2),
        active_users=int(active_users),
        paid_users=int(paid_users),
        guest_users=int(guest_users),
    )


@router.get("/users", response_model=AdminPaginatedUsers)
def list_users(
    _: AdminUser,
    db: DbSession,
    q: Optional[str] = None,
    role: Optional[str] = None,
    plan_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    query = db.query(User)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(User.email.ilike(like), User.full_name.ilike(like)))
    if role:
        try:
            query = query.filter(User.role == UserRole(role.upper()))
        except ValueError:
            raise AppError("Invalid role", code="invalid_role", status_code=400)
    if plan_id:
        query = query.filter(User.plan_id == plan_id.lower())
    if is_active is not None:
        query = query.filter(User.is_active.is_(is_active))
    total = query.count()
    users = query.order_by(User.created_at.desc()).offset(offset).limit(limit).all()
    return AdminPaginatedUsers(
        items=[_user_list_item(u) for u in users],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/users/{user_id}", response_model=AdminUserDetail)
def get_user(user_id: UUID, _: AdminUser, db: DbSession):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise AppError("User not found", code="not_found", status_code=404)
    sub = (
        db.query(Subscription)
        .filter(Subscription.user_id == user.id)
        .order_by(Subscription.created_at.desc())
        .first()
    )
    base = _user_list_item(user)
    return AdminUserDetail(
        **base.model_dump(),
        stripe_customer_id=user.stripe_customer_id,
        paddle_customer_id=getattr(user, "paddle_customer_id", None),
        subscription=_sub_summary(sub) if sub else None,
    )


@router.patch("/users/{user_id}", response_model=AdminUserDetail)
def patch_user(user_id: UUID, body: AdminUserPatch, admin: AdminUser, db: DbSession):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise AppError("User not found", code="not_found", status_code=404)

    changes: dict = {}

    if body.plan_id is not None:
        plan = body.plan_id.lower().strip()
        if plan not in ALLOWED_PLANS:
            raise AppError("Invalid plan", code="invalid_plan", status_code=400)
        if user.plan_id != plan:
            changes["plan_id"] = {"from": user.plan_id, "to": plan}
            user.plan_id = plan

    if body.role is not None:
        role_raw = body.role.upper().strip()
        try:
            new_role = UserRole(role_raw)
        except ValueError:
            raise AppError("Invalid role", code="invalid_role", status_code=400)
        if user.role != new_role:
            if user.role == UserRole.ADMIN and new_role != UserRole.ADMIN:
                if _admin_count(db) <= 1:
                    raise AppError(
                        "Cannot demote the last active admin",
                        code="last_admin",
                        status_code=400,
                    )
            changes["role"] = {"from": user.role.value, "to": new_role.value}
            user.role = new_role

    if body.is_active is not None and user.is_active != body.is_active:
        if user.role == UserRole.ADMIN and body.is_active is False:
            if _admin_count(db) <= 1:
                raise AppError(
                    "Cannot deactivate the last active admin",
                    code="last_admin",
                    status_code=400,
                )
            if user.id == admin.id:
                raise AppError("Cannot deactivate yourself", code="self_lockout", status_code=400)
        changes["is_active"] = {"from": user.is_active, "to": body.is_active}
        user.is_active = body.is_active

    if changes:
        record_admin_action(
            db,
            actor_id=admin.id,
            action="user.patch",
            target_type="user",
            target_id=str(user.id),
            payload=changes,
        )
        db.commit()
        db.refresh(user)

    return get_user(user_id, admin, db)


@router.post("/users/{user_id}/credits", response_model=UserOut)
def adjust_credits(
    user_id: UUID,
    body: AdminCreditAdjust,
    admin: AdminUser,
    db: DbSession,
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise AppError("User not found", code="not_found", status_code=404)
    CreditService(db).credit(
        user,
        body.amount,
        tx_type=CreditTransactionType.ADMIN_ADJUSTMENT,
        operation="admin_adjust",
        reference_id=f"admin-{user_id}-{body.amount}-{uuid4()}",
        note=body.note or "Admin adjustment",
    )
    record_admin_action(
        db,
        actor_id=admin.id,
        action="user.credits",
        target_type="user",
        target_id=str(user.id),
        payload={"amount": body.amount, "note": body.note},
    )
    db.commit()
    db.refresh(user)
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        credit_balance=user.credit_balance,
        reserved_credits=getattr(user, "reserved_credits", 0) or 0,
        plan_id=getattr(user, "plan_id", None) or "free",
        is_active=user.is_active,
        created_at=user.created_at,
    )


@router.get("/users/{user_id}/credits", response_model=AdminPaginatedCredits)
def user_credits(
    user_id: UUID,
    _: AdminUser,
    db: DbSession,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise AppError("User not found", code="not_found", status_code=404)
    q = db.query(CreditTransaction).filter(CreditTransaction.user_id == user_id)
    total = q.count()
    rows = q.order_by(CreditTransaction.created_at.desc()).offset(offset).limit(limit).all()
    return AdminPaginatedCredits(
        items=[
            AdminCreditTxOut(
                id=t.id,
                amount=t.amount,
                type=t.type.value if hasattr(t.type, "value") else str(t.type),
                operation=t.operation,
                reference_id=t.reference_id,
                balance_after=t.balance_after,
                note=t.note,
                created_at=t.created_at,
                user_id=user_id,
                user_email=user.email,
            )
            for t in rows
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/jobs", response_model=AdminPaginatedJobs)
def admin_jobs(
    _: AdminUser,
    db: DbSession,
    status: Optional[str] = None,
    job_type: Optional[str] = None,
    tool: Optional[str] = None,
    user_id: Optional[UUID] = None,
    q: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    query = db.query(ProcessingJob)
    if status:
        try:
            query = query.filter(ProcessingJob.status == JobStatus(status.upper()))
        except ValueError:
            raise AppError("Invalid status", code="invalid_status", status_code=400)
    if job_type:
        try:
            query = query.filter(ProcessingJob.job_type == JobType(job_type.upper()))
        except ValueError:
            raise AppError("Invalid job_type", code="invalid_job_type", status_code=400)
    if tool:
        query = query.filter(ProcessingJob.tool == tool)
    if user_id:
        query = query.filter(ProcessingJob.user_id == user_id)
    if q:
        like = f"%{q.strip()}%"
        query = query.outerjoin(User, User.id == ProcessingJob.user_id).filter(
            or_(User.email.ilike(like), ProcessingJob.error_message.ilike(like))
        )
    total = query.count()
    jobs = query.order_by(ProcessingJob.created_at.desc()).offset(offset).limit(limit).all()
    return AdminPaginatedJobs(
        items=[_job_detail(db, j) for j in jobs],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/jobs/{job_id}", response_model=AdminJobDetail)
def get_job(job_id: UUID, _: AdminUser, db: DbSession):
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if not job:
        raise AppError("Job not found", code="not_found", status_code=404)
    return _job_detail(db, job)


@router.get("/projects", response_model=AdminPaginatedProjects)
def admin_projects(
    _: AdminUser,
    db: DbSession,
    q: Optional[str] = None,
    user_id: Optional[UUID] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    query = db.query(Project)
    if user_id:
        query = query.filter(Project.user_id == user_id)
    if q:
        like = f"%{q.strip()}%"
        query = query.outerjoin(User, User.id == Project.user_id).filter(
            or_(Project.name.ilike(like), User.email.ilike(like))
        )
    total = query.count()
    rows = query.order_by(Project.created_at.desc()).offset(offset).limit(limit).all()
    items = []
    for p in rows:
        owner = db.query(User).filter(User.id == p.user_id).first()
        items.append(
            AdminProjectItem(
                id=p.id,
                name=p.name,
                description=p.description,
                user_id=p.user_id,
                user_email=owner.email if owner else None,
                created_at=p.created_at,
                updated_at=p.updated_at,
            )
        )
    return AdminPaginatedProjects(items=items, total=total, limit=limit, offset=offset)


@router.get("/credits", response_model=AdminPaginatedCredits)
def admin_credits(
    _: AdminUser,
    db: DbSession,
    user_id: Optional[UUID] = None,
    tx_type: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    query = db.query(CreditTransaction)
    if user_id:
        query = query.filter(CreditTransaction.user_id == user_id)
    if tx_type:
        try:
            query = query.filter(CreditTransaction.type == CreditTransactionType(tx_type.upper()))
        except ValueError:
            raise AppError("Invalid type", code="invalid_type", status_code=400)
    total = query.count()
    rows = query.order_by(CreditTransaction.created_at.desc()).offset(offset).limit(limit).all()
    items = []
    for t in rows:
        u = db.query(User).filter(User.id == t.user_id).first()
        items.append(
            AdminCreditTxOut(
                id=t.id,
                amount=t.amount,
                type=t.type.value if hasattr(t.type, "value") else str(t.type),
                operation=t.operation,
                reference_id=t.reference_id,
                balance_after=t.balance_after,
                note=t.note,
                created_at=t.created_at,
                user_id=t.user_id,
                user_email=u.email if u else None,
            )
        )
    return AdminPaginatedCredits(items=items, total=total, limit=limit, offset=offset)


@router.get("/billing/overview", response_model=AdminBillingOverview)
def billing_overview(_: AdminUser, db: DbSession):
    providers = billing_providers()
    plan_rows = db.query(User.plan_id, func.count(User.id)).group_by(User.plan_id).all()
    plan_counts = {str(pid or "free"): int(cnt) for pid, cnt in plan_rows}
    subs = (
        db.query(Subscription).order_by(Subscription.created_at.desc()).limit(30).all()
    )
    return AdminBillingOverview(
        providers=BillingProvidersOut(**providers),
        plan_counts=plan_counts,
        recent_subscriptions=[_sub_summary(s) for s in subs],
    )


@router.get("/audit", response_model=AdminPaginatedAudit)
def admin_audit(
    _: AdminUser,
    db: DbSession,
    action: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    query = db.query(AdminAuditLog)
    if action:
        query = query.filter(AdminAuditLog.action == action)
    total = query.count()
    rows = query.order_by(AdminAuditLog.created_at.desc()).offset(offset).limit(limit).all()
    items = []
    for r in rows:
        actor = db.query(User).filter(User.id == r.actor_id).first() if r.actor_id else None
        items.append(
            AdminAuditOut(
                id=r.id,
                actor_id=r.actor_id,
                actor_email=actor.email if actor else None,
                action=r.action,
                target_type=r.target_type,
                target_id=r.target_id,
                payload=r.payload,
                created_at=r.created_at,
            )
        )
    return AdminPaginatedAudit(items=items, total=total, limit=limit, offset=offset)
