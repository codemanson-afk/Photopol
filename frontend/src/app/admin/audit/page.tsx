"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminDataTable, AdminPager, type AdminColumn } from "@/components/admin/admin-table";
import { api } from "@/lib/api";
import type { AdminAuditEntry, AdminPage } from "@/lib/types";

const LIMIT = 50;

export default function AdminAuditPage() {
  const [action, setAction] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<AdminPage<AdminAuditEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
    if (action) params.set("action", action);
    try {
      setData(await api<AdminPage<AdminAuditEntry>>(`/admin/audit?${params}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [action, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const cols: AdminColumn<AdminAuditEntry>[] = [
    { key: "action", header: "Action", render: (r) => <span className="font-medium">{r.action}</span> },
    { key: "actor", header: "Actor", render: (r) => r.actor_email || "—" },
    {
      key: "target",
      header: "Target",
      render: (r) =>
        r.target_type === "user" && r.target_id ? (
          <Link href={`/admin/users/${r.target_id}`} className="text-[var(--accent)] hover:underline">
            {r.target_type}:{r.target_id.slice(0, 8)}
          </Link>
        ) : (
          `${r.target_type || "—"}:${r.target_id?.slice(0, 8) || "—"}`
        ),
    },
    {
      key: "payload",
      header: "Payload",
      render: (r) => (
        <span className="line-clamp-2 max-w-md font-mono text-xs text-[var(--muted)]">
          {r.payload ? JSON.stringify(r.payload) : "—"}
        </span>
      ),
    },
    {
      key: "when",
      header: "When",
      render: (r) => new Date(r.created_at).toLocaleString(),
    },
  ];

  return (
    <div className="fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Admin mutations (credits, user patches).</p>
      </div>

      <select
        className="input w-auto"
        value={action}
        onChange={(e) => {
          setOffset(0);
          setAction(e.target.value);
        }}
      >
        <option value="">All actions</option>
        <option value="user.patch">user.patch</option>
        <option value="user.credits">user.credits</option>
      </select>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      <AdminDataTable
        columns={cols}
        rows={data?.items || []}
        loading={loading}
        empty="No audit entries"
        rowKey={(r) => r.id}
      />
      {data && (
        <AdminPager total={data.total} limit={data.limit} offset={data.offset} onChange={setOffset} />
      )}
    </div>
  );
}
