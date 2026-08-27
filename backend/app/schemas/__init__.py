from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# Auth
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(ORMModel):
    id: UUID
    email: EmailStr
    full_name: str
    role: str
    credit_balance: int
    reserved_credits: int = 0
    plan_id: str = "free"
    is_active: bool
    created_at: datetime


# Projects
class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None


class ProjectOut(ORMModel):
    id: UUID
    name: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime


class RecentProjectOut(ProjectOut):
    thumbnail_url: Optional[str] = None
    last_operation: Optional[str] = None


class ProjectDetail(ProjectOut):
    images: List["ImageOut"] = []


# Images
class ImageVersionOut(ORMModel):
    id: UUID
    kind: str
    operation: Optional[str]
    content_type: str
    width: Optional[int]
    height: Optional[int]
    byte_size: int
    url: Optional[str] = None
    created_at: datetime


class ImageOut(ORMModel):
    id: UUID
    project_id: UUID
    original_filename: str
    content_type: str
    width: Optional[int]
    height: Optional[int]
    byte_size: int
    url: Optional[str] = None
    created_at: datetime
    versions: List[ImageVersionOut] = []


class JobOut(ORMModel):
    id: UUID
    job_type: str
    tool: Optional[str] = None
    model_id: Optional[str] = None
    status: str
    credit_cost: int
    credits_deducted: bool
    progress: int = 0
    error_message: Optional[str] = None
    error_code: Optional[str] = None
    result_version_id: Optional[UUID] = None
    created_at: datetime
    completed_at: Optional[datetime] = None


class JobCreateRequest(BaseModel):
    project_id: UUID
    image_id: UUID
    tool: str
    model_id: Optional[str] = None
    version_id: Optional[UUID] = None
    params: Optional[dict] = None
    idempotency_key: Optional[str] = None


class MaskUploadOut(BaseModel):
    mask_storage_key: str


class BackgroundRemovalRequest(BaseModel):
    image_id: UUID
    idempotency_key: Optional[str] = None
    model_id: Optional[str] = None


class ResizeRequest(BaseModel):
    image_id: UUID
    width: Optional[int] = Field(default=None, ge=16, le=8192)
    height: Optional[int] = Field(default=None, ge=16, le=8192)
    aspect_ratio: Optional[str] = None  # 1:1, 4:5, 16:9, 9:16
    version_id: Optional[UUID] = None


class CropRequest(BaseModel):
    image_id: UUID
    x: int = Field(ge=0)
    y: int = Field(ge=0)
    width: int = Field(ge=16, le=8192)
    height: int = Field(ge=16, le=8192)
    version_id: Optional[UUID] = None


class CreditTransactionOut(ORMModel):
    id: UUID
    amount: int
    type: str
    operation: Optional[str]
    reference_id: Optional[str]
    balance_after: int
    note: Optional[str]
    created_at: datetime


class DashboardStats(BaseModel):
    credit_balance: int
    images_processed: int
    storage_used_bytes: int
    project_count: int
    full_name: str
    email: EmailStr


class AdminStats(BaseModel):
    total_users: int
    images_processed: int
    processing_jobs: int
    failed_jobs: int
    credit_usage: int
    credits_spent: int = 0
    jobs_completed: int = 0
    avg_credits_per_job: float = 0.0
    active_users: int = 0
    paid_users: int = 0
    guest_users: int = 0


class AdminCreditAdjust(BaseModel):
    amount: int
    note: Optional[str] = None


class AdminUserPatch(BaseModel):
    is_active: Optional[bool] = None
    plan_id: Optional[str] = None
    role: Optional[str] = None  # USER | ADMIN


class AdminUserListItem(BaseModel):
    id: UUID
    email: str  # guests use @guest.local — not a public EmailStr
    full_name: str
    role: str
    credit_balance: int
    reserved_credits: int = 0
    plan_id: str = "free"
    is_active: bool
    is_guest: bool = False
    created_at: datetime


class AdminSubscriptionSummary(BaseModel):
    id: UUID
    provider: str
    plan_id: str
    status: str
    current_period_end: Optional[datetime] = None
    monthly_credit_allowance: int = 0


class AdminUserDetail(AdminUserListItem):
    stripe_customer_id: Optional[str] = None
    paddle_customer_id: Optional[str] = None
    subscription: Optional[AdminSubscriptionSummary] = None


class AdminJobDetail(JobOut):
    user_id: UUID
    project_id: UUID
    image_id: UUID
    provider: Optional[str] = None
    user_email: Optional[str] = None
    project_name: Optional[str] = None


class AdminProjectItem(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    user_id: UUID
    user_email: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class AdminCreditTxOut(CreditTransactionOut):
    user_id: UUID
    user_email: Optional[str] = None


class BillingProvidersOut(BaseModel):
    stripe: bool
    paddle: bool


class AdminBillingOverview(BaseModel):
    providers: BillingProvidersOut
    plan_counts: dict
    recent_subscriptions: List[AdminSubscriptionSummary]


class AdminAuditOut(BaseModel):
    id: UUID
    actor_id: Optional[UUID] = None
    actor_email: Optional[str] = None
    action: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    payload: Optional[dict] = None
    created_at: datetime


class AdminPaginatedUsers(BaseModel):
    items: List[AdminUserListItem]
    total: int
    limit: int
    offset: int


class AdminPaginatedJobs(BaseModel):
    items: List[AdminJobDetail]
    total: int
    limit: int
    offset: int


class AdminPaginatedProjects(BaseModel):
    items: List[AdminProjectItem]
    total: int
    limit: int
    offset: int


class AdminPaginatedCredits(BaseModel):
    items: List[AdminCreditTxOut]
    total: int
    limit: int
    offset: int


class AdminPaginatedAudit(BaseModel):
    items: List[AdminAuditOut]
    total: int
    limit: int
    offset: int


class CheckoutRequest(BaseModel):
    quantity: int = Field(default=1, ge=1, le=20)
    mode: str = Field(default="payment")  # payment | subscription
    plan: Optional[str] = None  # pro | business when mode=subscription
    provider: Optional[str] = None  # stripe | paddle


class PortalOut(BaseModel):
    portal_url: str


class BillingStatusOut(BaseModel):
    plan_id: str
    status: str
    credit_balance: int
    reserved_credits: int
    available_credits: int
    current_period_end: Optional[datetime] = None
    providers: BillingProvidersOut
    billing_provider: Optional[str] = None  # active sub provider


class BatchCreateRequest(BaseModel):
    project_id: UUID
    image_ids: List[UUID] = Field(min_length=1, max_length=20)
    tool: str
    model_id: Optional[str] = None
    params: Optional[dict] = None


class ExportPackRequest(BaseModel):
    project_id: UUID
    image_id: UUID
    version_id: Optional[UUID] = None
    group: str = "social"  # social | marketplace
    format: str = "jpg"
    quality: int = Field(default=92, ge=40, le=100)
    strip_metadata: bool = True
    preset_ids: Optional[List[str]] = None


class ProductPipelineRequest(BaseModel):
    project_id: UUID
    image_id: UUID
    version_id: Optional[UUID] = None
    bg_color: str = "#FFFFFF"
    drop_shadow: bool = True


class AutoEditAnalyzeRequest(BaseModel):
    project_id: UUID
    image_id: UUID
    version_id: Optional[UUID] = None


class AutoEditRunRequest(BaseModel):
    project_id: UUID
    image_id: UUID
    version_id: Optional[UUID] = None
    bg_color: str = "#FFFFFF"
    include_studio_bg: Optional[bool] = None
    include_upscale: Optional[bool] = None
    include_fit: Optional[bool] = None


class OutcomeAnalyzeRequest(BaseModel):
    project_id: UUID
    image_id: UUID
    version_id: Optional[UUID] = None


class OutcomeRunRequest(BaseModel):
    project_id: UUID
    image_id: UUID
    outcome: str  # store_ready | professional | ig_ad | custom
    version_id: Optional[UUID] = None
    intent_text: Optional[str] = None
    bg_color: str = "#FFFFFF"
    export_pack: bool = False
    variant: Optional[str] = None  # premium_look | white_bg | lifestyle | ig_square | ig_story


class MessageOut(BaseModel):
    message: str
