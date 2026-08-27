export type User = {
  id: string;
  email: string;
  full_name: string;
  role: "USER" | "ADMIN";
  credit_balance: number;
  reserved_credits?: number;
  plan_id?: string;
  is_active: boolean;
  created_at: string;
};

export type Project = {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
};

export type ImageVersion = {
  id: string;
  kind: string;
  operation?: string | null;
  content_type: string;
  width?: number | null;
  height?: number | null;
  byte_size: number;
  url?: string | null;
  created_at: string;
};

export type ImageItem = {
  id: string;
  project_id: string;
  original_filename: string;
  content_type: string;
  width?: number | null;
  height?: number | null;
  byte_size: number;
  url?: string | null;
  created_at: string;
  versions: ImageVersion[];
};

export type ProjectDetail = Project & { images: ImageItem[] };

export type Job = {
  id: string;
  job_type: string;
  tool?: string | null;
  model_id?: string | null;
  status: string;
  credit_cost: number;
  credits_deducted: boolean;
  progress?: number;
  error_message?: string | null;
  error_code?: string | null;
  result_version_id?: string | null;
  created_at: string;
  completed_at?: string | null;
};

export type DashboardStats = {
  credit_balance: number;
  images_processed: number;
  storage_used_bytes: number;
  project_count: number;
  full_name: string;
  email: string;
};

export type CreditTx = {
  id: string;
  amount: number;
  type: string;
  operation?: string | null;
  reference_id?: string | null;
  balance_after: number;
  note?: string | null;
  created_at: string;
};

export type AdminStats = {
  total_users: number;
  images_processed: number;
  processing_jobs: number;
  failed_jobs: number;
  credit_usage: number;
  credits_spent?: number;
  jobs_completed?: number;
  avg_credits_per_job?: number;
  active_users?: number;
  paid_users?: number;
  guest_users?: number;
};

export type AdminUserListItem = {
  id: string;
  email: string;
  full_name: string;
  role: "USER" | "ADMIN";
  credit_balance: number;
  reserved_credits: number;
  plan_id: string;
  is_active: boolean;
  is_guest: boolean;
  created_at: string;
};

export type AdminSubscriptionSummary = {
  id: string;
  provider: string;
  plan_id: string;
  status: string;
  current_period_end?: string | null;
  monthly_credit_allowance: number;
};

export type AdminUserDetail = AdminUserListItem & {
  stripe_customer_id?: string | null;
  paddle_customer_id?: string | null;
  subscription?: AdminSubscriptionSummary | null;
};

export type AdminJobDetail = Job & {
  user_id: string;
  project_id: string;
  image_id: string;
  provider?: string | null;
  user_email?: string | null;
  project_name?: string | null;
};

export type AdminProjectItem = {
  id: string;
  name: string;
  description?: string | null;
  user_id: string;
  user_email?: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminCreditTx = CreditTx & {
  user_id: string;
  user_email?: string | null;
};

export type AdminBillingOverview = {
  providers: { stripe: boolean; paddle: boolean };
  plan_counts: Record<string, number>;
  recent_subscriptions: AdminSubscriptionSummary[];
};

export type AdminAuditEntry = {
  id: string;
  actor_id?: string | null;
  actor_email?: string | null;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  payload?: Record<string, unknown> | null;
  created_at: string;
};

export type AdminPage<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};
