"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { CreditChip } from "@/components/ui/primitives";
import { OUTCOMES } from "@/lib/outcomes";

export default function EditHubPage() {
  const { user } = useAuth();

  return (
    <AppShell title="Edit">
      <div className="fade-in mx-auto max-w-3xl space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Edit Image</h1>
            <p className="mt-1 text-[var(--muted)]">
              Tell Photopol the result. AI handles the complicated edits.
            </p>
          </div>
          {user && <CreditChip balance={user.credit_balance} />}
        </div>

        <Link
          href="/workspace"
          className="card flex flex-col p-6 transition hover:border-[var(--accent)]/30"
        >
          <h2 className="text-lg font-semibold">Start editing</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Upload once → pick Online store ready, Look professional, Instagram ad, or describe
            what you want.
          </p>
          <span className="mt-4 text-sm font-medium text-[var(--accent)]">Open workspace →</span>
        </Link>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Results you can ask for</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {OUTCOMES.filter((o) => o.id !== "custom").map((o) => (
              <Link
                key={o.id}
                href={`/workspace?outcome=${o.id}`}
                className="card p-5 transition hover:border-[var(--accent)]/30"
              >
                <h3 className="font-semibold">{o.label}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{o.blurb}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
