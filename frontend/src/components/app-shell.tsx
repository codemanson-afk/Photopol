"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { UploadImageButton } from "@/components/upload-image-button";
import { CreditChip } from "@/components/ui/primitives";

const links = [
  { href: "/home", label: "Home" },
  { href: "/workspace", label: "Edit Image" },
  { href: "/history", label: "Projects" },
  { href: "/tools", label: "Results" },
  { href: "/credits", label: "Credits" },
  { href: "/billing", label: "Billing" },
  { href: "/settings", label: "Settings" },
];

const mobileLinks = [
  { href: "/home", label: "Home" },
  { href: "/workspace", label: "Edit" },
  { href: "/history", label: "Projects" },
  { href: "/credits", label: "Credits" },
  { href: "/billing", label: "Billing" },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarHue(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i) * 17) % 360;
  return h;
}

export function AppShell({
  children,
  title,
  action,
}: {
  children: React.ReactNode;
  dense?: boolean;
  title?: string;
  action?: React.ReactNode;
}) {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  if (!loading && !user) {
    router.replace("/login");
    return null;
  }

  function isActive(href: string) {
    if (href === "/home") return pathname === "/home" || pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const displayName = user?.full_name || "Account";
  const hue = avatarHue(displayName);

  const sideNav = (
    <nav className="flex flex-1 flex-col gap-1">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`min-h-11 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
            isActive(l.href)
              ? "bg-[var(--accent)] text-white"
              : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-white"
          }`}
        >
          {l.label}
        </Link>
      ))}
      {user?.role === "ADMIN" && (
        <>
          <div className="my-3 border-t border-white/10" />
          <Link
            href="/admin"
            className={`min-h-11 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              pathname.startsWith("/admin")
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-white"
            }`}
          >
            Admin Panel
          </Link>
        </>
      )}
      <button
        type="button"
        onClick={async () => {
          await logout();
          router.push("/");
        }}
        className="mt-auto min-h-11 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-white"
      >
        Logout
      </button>
    </nav>
  );

  return (
    <div className="flex min-h-screen w-full bg-[var(--bg)]">
      <aside className="hidden w-56 shrink-0 flex-col bg-[var(--sidebar)] px-3 py-5 text-white lg:flex">
        <Link href="/home" className="mb-8 flex items-center gap-2.5 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-sm font-bold">
            P
          </span>
          <span className="brand-mark text-lg">Photopol</span>
        </Link>
        {sideNav}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
        <header className="sticky top-0 z-30 flex w-full items-center justify-between gap-3 border-b border-[var(--border)] bg-white/90 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/home" className="flex items-center gap-2 lg:hidden">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent)] text-xs font-bold text-white">
                P
              </span>
              <span className="brand-mark text-base">Photopol</span>
            </Link>
            {title && (
              <h1 className="truncate text-sm font-medium text-[var(--muted)] lg:text-base lg:text-[var(--text)]">
                {title}
              </h1>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            {user && <CreditChip balance={user.credit_balance} />}
            <UploadImageButton className="btn btn-primary min-h-9 px-3 text-sm md:px-4">
              Upload Image
            </UploadImageButton>
            {action}
            {user && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-[#f3f3f6]"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                >
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{
                      background: `linear-gradient(135deg, hsl(${hue} 55% 48%), hsl(${(hue + 40) % 360} 60% 38%))`,
                    }}
                    aria-hidden
                  >
                    {initials(displayName)}
                  </span>
                  <span className="hidden max-w-[8rem] truncate text-sm font-medium text-[var(--text)] sm:inline">
                    {displayName}
                  </span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    className={`text-[var(--muted)] transition ${menuOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  >
                    <path
                      d="M6 9l6 6 6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-[var(--border)] bg-white py-1 shadow-[var(--shadow-soft)]"
                  >
                    <div className="border-b border-[var(--border)] px-3 py-2.5 sm:hidden">
                      <div className="truncate text-sm font-medium">{displayName}</div>
                      <div className="truncate text-xs text-[var(--muted)]">{user.email}</div>
                    </div>
                    <Link
                      href="/settings"
                      role="menuitem"
                      className="block px-3 py-2.5 text-sm text-[var(--text)] hover:bg-[#f7f7f9]"
                      onClick={() => setMenuOpen(false)}
                    >
                      Settings
                    </Link>
                    <Link
                      href="/billing"
                      role="menuitem"
                      className="block px-3 py-2.5 text-sm text-[var(--text)] hover:bg-[#f7f7f9]"
                      onClick={() => setMenuOpen(false)}
                    >
                      Billing
                    </Link>
                    <Link
                      href="/credits"
                      role="menuitem"
                      className="block px-3 py-2.5 text-sm text-[var(--text)] hover:bg-[#f7f7f9]"
                      onClick={() => setMenuOpen(false)}
                    >
                      Credits
                    </Link>
                    {user.role === "ADMIN" && (
                      <Link
                        href="/admin"
                        role="menuitem"
                        className="block px-3 py-2.5 text-sm text-[var(--text)] hover:bg-[#f7f7f9]"
                        onClick={() => setMenuOpen(false)}
                      >
                        Admin
                      </Link>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      className="block w-full px-3 py-2.5 text-left text-sm text-[var(--danger)] hover:bg-[#f7f7f9]"
                      onClick={async () => {
                        setMenuOpen(false);
                        await logout();
                        router.push("/");
                      }}
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="w-full flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-white safe-pb lg:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-between px-1 pt-1">
          {mobileLinks.map((l) => {
            const active = l.href === "/workspace" ? false : isActive(l.href);
            const isUpload = l.href === "/workspace";
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${
                  isUpload || active ? "text-[var(--accent)]" : "text-[var(--muted)]"
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    isUpload ? "bg-[var(--accent)] text-white" : active ? "bg-[var(--accent-soft)]" : ""
                  }`}
                >
                  {isUpload ? "+" : l.label.slice(0, 1)}
                </span>
                {l.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
