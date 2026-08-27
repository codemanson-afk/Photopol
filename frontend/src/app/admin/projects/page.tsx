"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminDataTable, AdminPager, type AdminColumn } from "@/components/admin/admin-table";
import { api } from "@/lib/api";
import type { AdminPage, AdminProjectItem } from "@/lib/types";

const LIMIT = 40;

function ProjectsInner() {
  const searchParams = useSearchParams();
  const [q, setQ] = useState("");
  const [userId, setUserId] = useState(searchParams.get("user_id") || "");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<AdminPage<AdminProjectItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
    if (q.trim()) params.set("q", q.trim());
    if (userId) params.set("user_id", userId);
    try {
      setData(await api<AdminPage<AdminProjectItem>>(`/admin/projects?${params}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [q, userId, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const cols: AdminColumn<AdminProjectItem>[] = [
    { key: "name", header: "Project", render: (r) => <span className="font-medium">{r.name}</span> },
    {
      key: "owner",
      header: "Owner",
      render: (r) => (
        <Link href={`/admin/users/${r.user_id}`} className="text-[var(--accent)] hover:underline">
          {r.user_email || r.user_id.slice(0, 8)}
        </Link>
      ),
    },
    {
      key: "created",
      header: "Created",
      render: (r) => new Date(r.created_at).toLocaleString(),
    },
  ];

  return (
    <div className="fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">All workspaces across accounts.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          className="input max-w-xs"
          placeholder="Search name / email"
          value={q}
          onChange={(e) => {
            setOffset(0);
            setQ(e.target.value);
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

      <AdminDataTable
        columns={cols}
        rows={data?.items || []}
        loading={loading}
        empty="No projects"
        rowKey={(r) => r.id}
      />
      {data && (
        <AdminPager total={data.total} limit={data.limit} offset={data.offset} onChange={setOffset} />
      )}
    </div>
  );
}

export default function AdminProjectsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
      <ProjectsInner />
    </Suspense>
  );
}
