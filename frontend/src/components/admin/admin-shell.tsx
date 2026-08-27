"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useEffect } from "react";

const NAV = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/jobs", label: "Jobs" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/credits", label: "Credits" },
  { href: "/admin/billing", label: "Billing" },
  { href: "/admin/audit", label: "Audit" },
] as const;

function navActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/admin")}`);
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f6f8] text-sm text-[var(--muted)]">
        Checking access…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f6f6f8] px-4 text-center text-sm text-[var(--muted)]">
        <p>Sign in required</p>
        <Link href="/login?next=/admin" className="text-[var(--accent)] hover:underline">
          Go to login →
        </Link>
      </div>
    );
  }

  if (user.role !== "ADMIN") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f6f6f8] px-4 text-center">
        <div>
          <p className="text-lg font-semibold text-[var(--text)]">Admin access required</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Signed in as <span className="font-medium text-[var(--text)]">{user.email}</span> (
            {user.role}). Use an ADMIN account.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
          <button
            type="button"
            className="btn btn-primary min-h-10 px-4"
            onClick={() => {
              void logout().then(() => router.replace("/login?next=/admin"));
            }}
          >
            Switch account
          </button>
          <Link href="/workspace" className="text-[var(--muted)] hover:text-[var(--text)]">
            Back to app
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f6f6f8] text-[var(--text)]">
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-[var(--border)] bg-white px-3 py-5">
        <div className="px-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Photopol
          </p>
          <p className="mt-1 text-lg font-bold tracking-tight">Ops</p>
        </div>
        <nav className="mt-6 flex flex-1 flex-col gap-0.5">
          {NAV.map((item) => {
            const active = navActive(pathname, item.href, "exact" in item && item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "text-[var(--muted)] hover:bg-[#f3f3f6] hover:text-[var(--text)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-2 border-t border-[var(--border)] px-2 pt-4 text-xs text-[var(--muted)]">
          <p className="truncate font-medium text-[var(--text)]">{user.email}</p>
          <Link href="/home" className="hover:text-[var(--accent)]">
            ← Back to app
          </Link>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-6 py-6 md:px-8">{children}</main>
    </div>
  );
}
