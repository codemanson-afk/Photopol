"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminDataTable, AdminPager, type AdminColumn } from "@/components/admin/admin-table";
import { api } from "@/lib/api";
import type { AdminCreditTx, AdminPage } from "@/lib/types";

const LIMIT = 50;

function CreditsInner() {
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState(searchParams.get("user_id") || "");
  const [txType, setTxType] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<AdminPage<AdminCreditTx> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
    if (userId) params.set("user_id", userId);
    if (txType) params.set("tx_type", txType);
    try {
      setData(await api<AdminPage<AdminCreditTx>>(`/admin/credits?${params}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [userId, txType, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const cols: AdminColumn<AdminCreditTx>[] = [
    {
      key: "amt",
      header: "Amount",
      className: "tabular-nums",
      render: (r) => (
        <span className={r.amount >= 0 ? "text-emerald-700" : "text-[var(--danger)]"}>
          {r.amount > 0 ? `+${r.amount}` : r.amount}
        </span>
      ),
    },
    { key: "type", header: "Type", render: (r) => r.type },
    {
      key: "user",
      header: "User",
      render: (r) => (
        <Link href={`/admin/users/${r.user_id}`} className="text-[var(--accent)] hover:underline">
          {r.user_email || r.user_id.slice(0, 8)}
        </Link>
      ),
    },
    { key: "note", header: "Note", render: (r) => r.note || r.operation || "—" },
    {
      key: "bal",
      header: "Balance after",
      className: "tabular-nums",
      render: (r) => r.balance_after,
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
        <h1 className="text-2xl font-bold tracking-tight">Credits</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Global ledger across all accounts.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          className="input w-auto"
          value={txType}
          onChange={(e) => {
            setOffset(0);
            setTxType(e.target.value);
          }}
        >
          <option value="">All types</option>
          {[
            "PURCHASE",
            "SUBSCRIPTION_GRANT",
            "ADMIN_ADJUSTMENT",
            "AI_OPERATION",
            "REFUND",
            "SIGNUP_BONUS",
          ].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
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
        empty="No transactions"
        rowKey={(r) => r.id}
      />
      {data && (
        <AdminPager total={data.total} limit={data.limit} offset={data.offset} onChange={setOffset} />
      )}
    </div>
  );
}

export default function AdminCreditsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
      <CreditsInner />
    </Suspense>
  );
}
