"use client";

import { AppShell } from "@/components/app-shell";
import { CreditChip } from "@/components/ui/primitives";
import { useAuth } from "@/components/auth-provider";

export default function SettingsPage() {
  const { user } = useAuth();
  return (
    <AppShell title="Settings">
      <div className="fade-in mx-auto max-w-md space-y-6">
        <div className="card space-y-5 p-6">
          <div>
            <div className="text-sm text-[var(--muted)]">Name</div>
            <div className="mt-1 font-medium">{user?.full_name}</div>
          </div>
          <div>
            <div className="text-sm text-[var(--muted)]">Email</div>
            <div className="mt-1 font-medium">{user?.email}</div>
          </div>
          <div>
            <div className="text-sm text-[var(--muted)]">Credits</div>
            <div className="mt-2">{user && <CreditChip balance={user.credit_balance} />}</div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
