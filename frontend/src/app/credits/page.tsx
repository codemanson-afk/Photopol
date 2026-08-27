"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CreditChip } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import type { CreditTx } from "@/lib/types";
import { useAuth } from "@/components/auth-provider";

export default function CreditsPage() {
  const { user, refresh } = useAuth();
  const [rows, setRows] = useState<CreditTx[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    refresh().catch(() => undefined);
    api<CreditTx[]>("/credits/transactions")
      .then(setRows)
      .catch((e) => setError(e.message));
  }, [refresh]);

  return (
    <AppShell title="Credits">
      <div className="fade-in mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <p className="text-[var(--muted)]">Balance and activity</p>
          {user && <CreditChip balance={user.credit_balance} />}
        </div>
        <div className="card inline-block px-6 py-5">
          <div className="text-sm text-[var(--muted)]">Current balance</div>
          <div className="mt-1 text-3xl font-semibold">{user?.credit_balance ?? "—"}</div>
          <Link href="/billing" className="mt-3 inline-block text-sm text-[var(--accent)]">
            Buy credits →
          </Link>
        </div>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-[var(--border)] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Operation</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border)]">
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{r.type}</td>
                  <td className="px-4 py-3">{r.operation || "—"}</td>
                  <td className="px-4 py-3">{r.amount}</td>
                  <td className="px-4 py-3">{r.balance_after}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
                    No transactions yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
