"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminDataTable, AdminPager, type AdminColumn } from "@/components/admin/admin-table";
import { api } from "@/lib/api";
import type { AdminPage, AdminUserListItem } from "@/lib/types";

const LIMIT = 40;

export default function AdminUsersPage() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [plan, setPlan] = useState("");
  const [active, setActive] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<AdminPage<AdminUserListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
    if (q.trim()) params.set("q", q.trim());
    if (role) params.set("role", role);
    if (plan) params.set("plan_id", plan);
    if (active === "true" || active === "false") params.set("is_active", active);
    try {
      const res = await api<AdminPage<AdminUserListItem>>(`/admin/users?${params}`);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [q, role, plan, active, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const cols: AdminColumn<AdminUserListItem>[] = [
    {
      key: "user",
      header: "User",
      render: (r) => (
        <div>
          <Link href={`/admin/users/${r.id}`} className="font-medium text-[var(--accent)] hover:underline">
            {r.full_name}
          </Link>
          <div className="text-xs text-[var(--muted)]">{r.email}</div>
        </div>
      ),
    },
    { key: "role", header: "Role", render: (r) => r.role },
    { key: "plan", header: "Plan", render: (r) => <span className="capitalize">{r.plan_id}</span> },
    {
      key: "credits",
      header: "Credits",
      className: "tabular-nums",
      render: (r) => r.credit_balance,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <span className={r.is_active ? "text-emerald-700" : "text-[var(--danger)]"}>
          {r.is_active ? "Active" : "Inactive"}
          {r.is_guest ? " · guest" : ""}
        </span>
      ),
    },
    {
      key: "created",
      header: "Joined",
      render: (r) => new Date(r.created_at).toLocaleDateString(),
    },
  ];

  return (
    <div className="fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Search, filter, and open a user for actions.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          className="input max-w-xs"
          placeholder="Search email or name"
          value={q}
          onChange={(e) => {
            setOffset(0);
            setQ(e.target.value);
          }}
        />
        <select
          className="input w-auto"
          value={role}
          onChange={(e) => {
            setOffset(0);
            setRole(e.target.value);
          }}
        >
          <option value="">All roles</option>
          <option value="USER">USER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <select
          className="input w-auto"
          value={plan}
          onChange={(e) => {
            setOffset(0);
            setPlan(e.target.value);
          }}
        >
          <option value="">All plans</option>
          <option value="free">free</option>
          <option value="pro">pro</option>
          <option value="business">business</option>
        </select>
        <select
          className="input w-auto"
          value={active}
          onChange={(e) => {
            setOffset(0);
            setActive(e.target.value);
          }}
        >
          <option value="">Active / inactive</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      <AdminDataTable
        columns={cols}
        rows={data?.items || []}
        loading={loading}
        empty="No users match"
        rowKey={(r) => r.id}
      />
      {data && (
        <AdminPager total={data.total} limit={data.limit} offset={data.offset} onChange={setOffset} />
      )}
    </div>
  );
}
