"use client";

import Link from "next/link";

export function GuestChrome({
  children,
}: {
  children: React.ReactNode;
  dense?: boolean;
}) {
  return (
    <div className="stage min-h-screen">{children}</div>
  );
}

/** Floating glass top bar used across workspace */
export function StageTopBar({
  left,
  center,
  right,
}: {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-3 md:p-5">
      <div className="pointer-events-auto">{left}</div>
      <div className="pointer-events-auto">{center}</div>
      <div className="pointer-events-auto">{right}</div>
    </header>
  );
}

export function BrandLink({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="brand-mark text-lg text-white md:text-xl">
      Photopol
    </Link>
  );
}
