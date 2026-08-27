"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminDataTable, AdminPager, type AdminColumn } from "@/components/admin/admin-table";
import { api } from "@/lib/api";
import type { AdminJobDetail, AdminPage } from "@/lib/types";

const LIMIT = 40;

function JobsInner() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [tool, setTool] = useState("");
  const [q, setQ] = useState("");
  const [userId, setUserId] = useState(searchParams.get("user_id") || "");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<AdminJobDetail | null>(null);
  const [data, setData] = useState<AdminPage<AdminJobDetail> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
    if (status) params.set("status", status);
    if (tool) params.set("tool", tool);
    if (q.trim()) params.set("q", q.trim());
    if (userId) params.set("user_id", userId);
    try {
      const res = await api<AdminPage<AdminJobDetail>>(`/admin/jobs?${params}`);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [status, tool, q, userId, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const cols: AdminColumn<AdminJobDetail>[] = [
    {
      key: "job",
      header: "Job",
      render: (r) => (
        <button
          type="button"
          className="text-left font-medium text-[var(--accent)] hover:underline"
          onClick={() => setSelected(r)}
        >
          {r.tool || r.job_type}
        </button>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <span className={r.status === "FAILED" ? "text-[var(--danger)]" : ""}>{r.status}</span>
      ),
    },
    {
      key: "user",
      header: "User",
      render: (r) =>
        r.user_id ? (
          <Link href={`/admin/users/${r.user_id}`} className="hover:underline">
            {r.user_email || r.user_id.slice(0, 8)}
          </Link>
        ) : (
          "—"
        ),
    },
    {
      key: "cost",
      header: "Credits",
      className: "tabular-nums",
      render: (r) => r.credit_cost,
    },
    {
      key: "when",
      header: "Created",
      render: (r) => new Date(r.created_at).toLocaleString(),
    },
  ];

  return (
    <div className="fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Jobs</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Filter processing jobs and inspect failures.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          className="input max-w-xs"
          placeholder="Search email / error"
          value={q}
          onChange={(e) => {
            setOffset(0);
            setQ(e.target.value);
          }}
        />
        <select
          className="input w-auto"
          value={status}
          onChange={(e) => {
            setOffset(0);
            setStatus(e.target.value);
          }}
        >
          <option value="">All statuses</option>
          {["PENDING", "QUEUED", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          className="input w-40"
          placeholder="tool id"
          value={tool}
          onChange={(e) => {
            setOffset(0);
            setTool(e.target.value);
          }}
        />
        {userId && (
          <button
            type="button"
            className="btn btn-ghost min-h-10 text-sm"
            onClick={() => {
              setUserId("");
              setOffset(0);
            }}
          >
            Clear user filter
          </button>
        )}
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          <AdminDataTable
            columns={cols}
            rows={data?.items || []}
            loading={loading}
            empty="No jobs"
            rowKey={(r) => r.id}
          />
          {data && (
            <AdminPager total={data.total} limit={data.limit} offset={data.offset} onChange={setOffset} />
          )}
        </div>

        <aside className="rounded-xl border border-[var(--border)] bg-white p-4 text-sm">
          <h2 className="font-semibold">Detail</h2>
          {!selected ? (
            <p className="mt-2 text-[var(--muted)]">Select a job</p>
          ) : (
            <dl className="mt-3 space-y-2">
              <div>
                <dt className="text-xs text-[var(--muted)]">ID</dt>
                <dd className="break-all font-mono text-xs">{selected.id}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted)]">Status</dt>
                <dd>{selected.status}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted)]">Project</dt>
                <dd>{selected.project_name || selected.project_id}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted)]">Provider / model</dt>
                <dd>
                  {selected.provider || "—"} · {selected.model_id || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted)]">Error</dt>
                <dd className="text-[var(--danger)]">
                  {selected.error_message || selected.error_code || "—"}
                </dd>
              </div>
            </dl>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function AdminJobsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
      <JobsInner />
    </Suspense>
  );
}
