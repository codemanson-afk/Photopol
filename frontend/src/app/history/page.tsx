"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { friendlyError } from "@/lib/errors";

type RecentProject = {
  id: string;
  name: string;
  updated_at: string;
  thumbnail_url?: string | null;
  last_operation?: string | null;
};

export default function HistoryPage() {
  const [rows, setRows] = useState<RecentProject[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<RecentProject[]>("/dashboard/recent-projects")
      .then(setRows)
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell title="My Projects">
      <div className="fade-in">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-[var(--muted)]">Open any project to keep editing.</p>
          <Link href="/workspace" className="btn btn-primary min-h-11">
            Upload Image
          </Link>
        </div>
        {error && <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>}
        {loading ? (
          <p className="mt-10 text-[var(--muted)]">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              title="No projects yet"
              body="Upload an image to get started."
              action={
                <Link href="/workspace" className="btn btn-primary min-h-11">
                  Upload
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {rows.map((p) => (
              <Link
                key={p.id}
                href={`/workspace?project=${p.id}`}
                className="card overflow-hidden transition hover:shadow-[var(--shadow-soft)]"
              >
                <div className="aspect-square bg-[#eef0f5]">
                  {p.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumbnail_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-[var(--muted)]">
                      —
                    </div>
                  )}
                </div>
                <div className="space-y-0.5 p-2.5">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="text-[11px] text-[var(--muted)]">
                    {new Date(p.updated_at).toLocaleDateString()}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
