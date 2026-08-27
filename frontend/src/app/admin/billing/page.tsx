"use client";

import { useEffect, useState } from "react";
import { AdminKpi } from "@/components/admin/admin-kpi";
import { AdminDataTable, type AdminColumn } from "@/components/admin/admin-table";
import { api } from "@/lib/api";
import type { AdminBillingOverview, AdminSubscriptionSummary } from "@/lib/types";

export default function AdminBillingPage() {
  const [data, setData] = useState<AdminBillingOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<AdminBillingOverview>("/admin/billing/overview")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, []);

  const cols: AdminColumn<AdminSubscriptionSummary>[] = [
    { key: "provider", header: "Provider", render: (r) => <span className="capitalize">{r.provider}</span> },
    { key: "plan", header: "Plan", render: (r) => <span className="capitalize">{r.plan_id}</span> },
    { key: "status", header: "Status", render: (r) => r.status },
    {
      key: "allowance",
      header: "Allowance",
      className: "tabular-nums",
      render: (r) => r.monthly_credit_allowance,
    },
    {
      key: "end",
      header: "Period end",
      render: (r) => (r.current_period_end ? new Date(r.current_period_end).toLocaleDateString() : "—"),
    },
  ];

  return (
    <div className="fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Read-only snapshot. Provider on/off is env-only (`STRIPE_ENABLED` / `PADDLE_ENABLED`).
        </p>
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminKpi
          label="Stripe"
          value={data?.providers.stripe ? "On" : "Off"}
          hint="Checkout usable when key + enabled"
        />
        <AdminKpi
          label="Paddle"
          value={data?.providers.paddle ? "On" : "Off"}
          hint="Checkout usable when key + enabled"
        />
        {Object.entries(data?.plan_counts || {}).map(([plan, count]) => (
          <AdminKpi key={plan} label={`Plan · ${plan}`} value={count} />
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Recent subscriptions</h2>
        <AdminDataTable
          columns={cols}
          rows={data?.recent_subscriptions || []}
          loading={loading}
          empty="No subscriptions"
          rowKey={(r) => r.id}
        />
      </section>
    </div>
  );
}
