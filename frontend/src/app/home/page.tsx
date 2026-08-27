"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { api } from "@/lib/api";
import { friendlyError } from "@/lib/errors";
import type { DashboardStats } from "@/lib/types";

type RecentProject = {
  id: string;
  name: string;
  updated_at: string;
  thumbnail_url?: string | null;
  last_operation?: string | null;
};

function relativeTime(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hours ago`;
  return new Date(iso).toLocaleDateString();
}

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

const HUB = [
  {
    href: "/workspace",
    title: "Edit Image",
    body: "Upload → tell Photopol the result you want → AI does the hard part.",
    cta: "Open",
    live: true,
  },
  {
    href: "/create",
    title: "Create with AI",
    body: "Describe what you want. AI decides how to make it.",
    cta: "Coming soon",
    live: false,
  },
  {
    href: "/create-video",
    title: "Create Video",
    body: "Describe + duration + platform. AI handles production.",
    cta: "Coming soon",
    live: false,
  },
  {
    href: "/captions",
    title: "AI Captions",
    body: "Upload video → beautiful captions. Style & language only.",
    cta: "Coming soon",
    live: false,
  },
] as const;

const OUTCOME_LINKS = [
  { href: "/workspace?outcome=store_ready", label: "Online store ready" },
  { href: "/workspace?outcome=professional", label: "Look professional" },
  { href: "/workspace?outcome=ig_ad", label: "Instagram ad" },
] as const;

export default function HomePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<RecentProject[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<DashboardStats>("/dashboard/stats"),
      api<RecentProject[]>("/dashboard/recent-projects"),
    ])
      .then(([s, p]) => {
        setStats(s);
        setRecent(p.slice(0, 8));
      })
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false));
  }, []);

  const firstName = (stats?.full_name || user?.full_name || "there").split(" ")[0];
  const used = stats?.storage_used_bytes ?? 0;
  const usedPct = Math.min(100, Math.round((used / (10 * 1024 * 1024 * 1024)) * 100));
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  return (
    <AppShell title="Home">
      <div className="fade-in space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Welcome back, {firstName}
          </h1>
        </div>

        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

        {loading ? (
          <p className="text-[var(--muted)]">Loading…</p>
        ) : (
          <>
            <section>
              <h2 className="mb-1 text-lg font-semibold">What do you want?</h2>
              <p className="mb-4 text-sm text-[var(--muted)]">
                Pick a result — not a tool.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {HUB.map((h) => (
                  <Link
                    key={h.href}
                    href={h.href}
                    className={`card flex min-h-[8rem] flex-col justify-between p-5 transition hover:border-[var(--accent)]/30 ${
                      !h.live ? "opacity-90" : ""
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{h.title}</span>
                        {!h.live && (
                          <span className="rounded-full bg-[#eef0f5] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                            Soon
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-[var(--muted)]">{h.body}</p>
                    </div>
                    <span className="mt-4 text-sm font-medium text-[var(--accent)]">{h.cta} →</span>
                  </Link>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">Quick results</h2>
              <div className="flex flex-wrap gap-2">
                {OUTCOME_LINKS.map((o) => (
                  <Link
                    key={o.href}
                    href={o.href}
                    className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium hover:border-[var(--accent)]/40"
                  >
                    {o.label}
                  </Link>
                ))}
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="card p-5">
                <div className="text-sm text-[var(--muted)]">Credits Balance</div>
                <div className="mt-2 text-2xl font-semibold">
                  {stats?.credit_balance ?? user?.credit_balance ?? 0} credits
                </div>
                <Link href="/billing" className="mt-3 inline-block text-sm text-[var(--accent)]">
                  Buy more credits →
                </Link>
              </div>
              <div className="card p-5">
                <div className="text-sm text-[var(--muted)]">Images Processed</div>
                <div className="mt-2 text-2xl font-semibold">
                  {stats?.images_processed ?? 0}{" "}
                  <span className="text-base font-normal text-[var(--muted)]">this month</span>
                </div>
              </div>
              <div className="card p-5">
                <div className="text-sm text-[var(--muted)]">Storage Used</div>
                <div className="mt-2 text-2xl font-semibold">
                  {formatBytes(used)}{" "}
                  <span className="text-base font-normal text-[var(--muted)]">of 10 GB</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#eef0f5]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
              </div>
              <div className="card p-5">
                <div className="text-sm text-[var(--muted)]">Member Since</div>
                <div className="mt-2 text-2xl font-semibold">{memberSince}</div>
              </div>
            </div>

            <section>
              <div className="mb-4 flex items-end justify-between">
                <h2 className="text-lg font-semibold">Recent Projects</h2>
                <Link href="/history" className="text-sm text-[var(--accent)]">
                  View all
                </Link>
              </div>
              {recent.length === 0 ? (
                <div className="card p-10 text-center text-[var(--muted)]">
                  No projects yet.{" "}
                  <Link href="/workspace" className="text-[var(--accent)]">
                    Edit your first image
                  </Link>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {recent.map((p) => (
                    <Link
                      key={p.id}
                      href={`/workspace?project=${p.id}`}
                      className="card overflow-hidden transition hover:shadow-[var(--shadow-soft)]"
                    >
                      <div className="aspect-[4/3] bg-[#eef0f5]">
                        {p.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.thumbnail_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-[var(--muted)]">
                            No preview
                          </div>
                        )}
                      </div>
                      <div className="space-y-1 p-3">
                        <div className="truncate font-medium">{p.name}</div>
                        <div className="text-xs text-[var(--muted)]">{relativeTime(p.updated_at)}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
