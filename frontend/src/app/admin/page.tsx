"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminKpi } from "@/components/admin/admin-kpi";
import { AdminDataTable, type AdminColumn } from "@/components/admin/admin-table";
import { api } from "@/lib/api";
import type { AdminAuditEntry, AdminJobDetail, AdminPage, AdminStats } from "@/lib/types";

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [failed, setFailed] = useState<AdminJobDetail[]>([]);
  const [audit, setAudit] = useState<AdminAuditEntry[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api<AdminStats>("/admin/stats"),
      api<AdminPage<AdminJobDetail>>("/admin/jobs?status=FAILED&limit=8"),
      api<AdminPage<AdminAuditEntry>>("/admin/audit?limit=8"),
    ])
      .then(([s, j, a]) => {
        setStats(s);
        setFailed(j.items);
        setAudit(a.items);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const failCols: AdminColumn<AdminJobDetail>[] = [
    {
      key: "type",
      header: "Job",
      render: (r) => r.tool || r.job_type,
    },
    {
      key: "user",
      header: "User",
      render: (r) => r.user_email || "—",
    },
    {
      key: "err",
      header: "Error",
      render: (r) => (
        <span className="line-clamp-1 max-w-xs text-[var(--danger)]">{r.error_message || r.error_code || "—"}</span>
      ),
    },
    {
      key: "when",
      header: "When",
      render: (r) => new Date(r.created_at).toLocaleString(),
    },
  ];

  const auditCols: AdminColumn<AdminAuditEntry>[] = [
    { key: "action", header: "Action", render: (r) => r.action },
    { key: "actor", header: "Actor", render: (r) => r.actor_email || "—" },
    { key: "target", header: "Target", render: (r) => r.target_id?.slice(0, 8) || "—" },
    {
      key: "when",
      header: "When",
      render: (r) => new Date(r.created_at).toLocaleString(),
    },
  ];

  return (
    <div className="fade-in space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Ops snapshot across users, jobs, and credits.</p>
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminKpi label="Users" value={stats?.total_users} hint={`${stats?.active_users ?? "—"} active`} />
        <AdminKpi label="Paid plans" value={stats?.paid_users} hint={`${stats?.guest_users ?? 0} guests`} />
        <AdminKpi label="Jobs" value={stats?.processing_jobs} hint={`${stats?.failed_jobs ?? 0} failed`} />
        <AdminKpi
          label="Credits spent"
          value={stats?.credits_spent ?? stats?.credit_usage}
          hint={`avg ${stats?.avg_credits_per_job ?? "—"} / job`}
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent failed jobs</h2>
          <Link href="/admin/jobs?status=FAILED" className="text-xs font-medium text-[var(--accent)]">
            View all →
          </Link>
        </div>
        <AdminDataTable
          columns={failCols}
          rows={failed}
          loading={loading}
          empty="No recent failures"
          rowKey={(r) => r.id}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent admin actions</h2>
          <Link href="/admin/audit" className="text-xs font-medium text-[var(--accent)]">
            Audit log →
          </Link>
        </div>
        <AdminDataTable
          columns={auditCols}
          rows={audit}
          loading={loading}
          empty="No audit entries yet"
          rowKey={(r) => r.id}
        />
      </section>
    </div>
  );
}
