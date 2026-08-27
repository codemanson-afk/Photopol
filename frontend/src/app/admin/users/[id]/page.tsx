"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AdminDataTable, type AdminColumn } from "@/components/admin/admin-table";
import { api } from "@/lib/api";
import type { AdminCreditTx, AdminPage, AdminUserDetail } from "@/lib/types";

export default function AdminUserDetailPage() {
  const params = useParams();
  const userId = String(params.id || "");
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [ledger, setLedger] = useState<AdminCreditTx[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [planId, setPlanId] = useState("free");
  const [role, setRole] = useState<"USER" | "ADMIN">("USER");
  const [isActive, setIsActive] = useState(true);
  const [amount, setAmount] = useState(10);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    if (!userId) return;
    setError("");
    try {
      const [u, c] = await Promise.all([
        api<AdminUserDetail>(`/admin/users/${userId}`),
        api<AdminPage<AdminCreditTx>>(`/admin/users/${userId}/credits?limit=15`),
      ]);
      setUser(u);
      setPlanId(u.plan_id);
      setRole(u.role);
      setIsActive(u.is_active);
      setLedger(c.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePatch() {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const updated = await api<AdminUserDetail>(`/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ plan_id: planId, role, is_active: isActive }),
      });
      setUser(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Patch failed");
    } finally {
      setBusy(false);
    }
  }

  async function onCredits(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      await api(`/admin/users/${user.id}/credits`, {
        method: "POST",
        body: JSON.stringify({ amount, note }),
      });
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Credit adjust failed");
    } finally {
      setBusy(false);
    }
  }

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
    { key: "note", header: "Note", render: (r) => r.note || r.operation || "—" },
    {
      key: "when",
      header: "When",
      render: (r) => new Date(r.created_at).toLocaleString(),
    },
  ];

  if (!user && !error) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  return (
    <div className="fade-in space-y-6">
      <div>
        <Link href="/admin/users" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
          ← Users
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{user?.full_name || "User"}</h1>
        <p className="text-sm text-[var(--muted)]">{user?.email}</p>
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      {user && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-white p-5">
              <h2 className="text-sm font-semibold">Account</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--muted)]">Credits</dt>
                  <dd className="tabular-nums font-medium">{user.credit_balance}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--muted)]">Reserved</dt>
                  <dd className="tabular-nums">{user.reserved_credits}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--muted)]">Guest</dt>
                  <dd>{user.is_guest ? "Yes" : "No"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--muted)]">Stripe</dt>
                  <dd className="truncate text-xs">{user.stripe_customer_id || "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--muted)]">Paddle</dt>
                  <dd className="truncate text-xs">{user.paddle_customer_id || "—"}</dd>
                </div>
              </dl>

              <div className="mt-5 space-y-3 border-t border-[var(--border)] pt-4">
                <label className="block text-xs text-[var(--muted)]">
                  Plan
                  <select className="input mt-1" value={planId} onChange={(e) => setPlanId(e.target.value)}>
                    <option value="free">free</option>
                    <option value="pro">pro</option>
                    <option value="business">business</option>
                  </select>
                </label>
                <label className="block text-xs text-[var(--muted)]">
                  Role
                  <select
                    className="input mt-1"
                    value={role}
                    onChange={(e) => setRole(e.target.value as "USER" | "ADMIN")}
                  >
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                  Active
                </label>
                <button
                  type="button"
                  className="btn btn-primary min-h-10 w-full"
                  disabled={busy}
                  onClick={() => void savePatch()}
                >
                  Save changes
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--border)] bg-white p-5">
                <h2 className="text-sm font-semibold">Subscription</h2>
                {user.subscription ? (
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-[var(--muted)]">Provider</dt>
                      <dd className="capitalize">{user.subscription.provider}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[var(--muted)]">Plan</dt>
                      <dd className="capitalize">{user.subscription.plan_id}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[var(--muted)]">Status</dt>
                      <dd>{user.subscription.status}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-2 text-sm text-[var(--muted)]">No subscription row</p>
                )}
              </div>

              <form onSubmit={onCredits} className="rounded-xl border border-[var(--border)] bg-white p-5">
                <h2 className="text-sm font-semibold">Adjust credits</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs text-[var(--muted)]">
                    Amount (+/−)
                    <input
                      className="input mt-1"
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                    />
                  </label>
                  <label className="block text-xs text-[var(--muted)]">
                    Note
                    <input className="input mt-1" value={note} onChange={(e) => setNote(e.target.value)} />
                  </label>
                </div>
                <button type="submit" className="btn btn-ghost mt-3 min-h-10 w-full" disabled={busy}>
                  Apply adjustment
                </button>
              </form>

              <div className="flex flex-wrap gap-3 text-sm">
                <Link href={`/admin/jobs?user_id=${user.id}`} className="text-[var(--accent)] hover:underline">
                  Jobs →
                </Link>
                <Link href={`/admin/projects?user_id=${user.id}`} className="text-[var(--accent)] hover:underline">
                  Projects →
                </Link>
                <Link href={`/admin/credits?user_id=${user.id}`} className="text-[var(--accent)] hover:underline">
                  Full ledger →
                </Link>
              </div>
            </div>
          </div>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Recent ledger</h2>
            <AdminDataTable columns={cols} rows={ledger} empty="No transactions" rowKey={(r) => r.id} />
          </section>
        </>
      )}
    </div>
  );
}
