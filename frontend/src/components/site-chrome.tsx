"use client";

import Link from "next/link";
import { UploadImageButton } from "@/components/upload-image-button";

export function SiteHeader() {
  return (
    <header className="relative z-20 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 md:px-6">
        <Link href="/" className="brand-mark shrink-0 text-xl text-[var(--text)] md:text-2xl">
          Photopol
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm text-[#52525b] sm:gap-x-6 md:gap-x-7">
          <Link href="/#tools" className="hover:text-[var(--text)]">
            Results
          </Link>
          <Link href="/#workflow" className="hover:text-[var(--text)]">
            How it works
          </Link>
          <UploadImageButton className="btn btn-ghost min-h-9 rounded-xl px-4 py-2 text-sm sm:min-h-10 sm:px-5">
            Edit Image
          </UploadImageButton>
          <Link href="/login" className="hover:text-[var(--text)]">
            Log in
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-white py-14 text-sm text-[#52525b]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:grid-cols-2 md:grid-cols-4 md:px-6">
        <div className="sm:col-span-2 md:col-span-1">
          <div className="brand-mark text-lg text-[var(--text)]">Photopol</div>
          <p className="mt-3 max-w-xs leading-relaxed">One powerful image workspace.</p>
        </div>
        <div className="flex flex-col gap-2.5">
          <span className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text)]">
            Results
          </span>
          <Link href="/workspace?outcome=store_ready" className="hover:text-[var(--text)]">
            Online store ready
          </Link>
          <Link href="/workspace?outcome=professional" className="hover:text-[var(--text)]">
            Look professional
          </Link>
          <Link href="/workspace?outcome=ig_ad" className="hover:text-[var(--text)]">
            Instagram ad
          </Link>
          <Link href="/workspace" className="hover:text-[var(--text)]">
            Edit Image
          </Link>
          <Link href="/product-photo-editor" className="hover:text-[var(--text)]">
            Product photos
          </Link>
        </div>
        <div className="flex flex-col gap-2.5">
          <span className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text)]">
            Account
          </span>
          <Link href="/login" className="hover:text-[var(--text)]">
            Log in
          </Link>
          <Link href="/register" className="hover:text-[var(--text)]">
            Register
          </Link>
          <Link href="/billing" className="hover:text-[var(--text)]">
            Billing
          </Link>
        </div>
        <div className="flex flex-col gap-2.5">
          <span className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text)]">
            Company
          </span>
          <Link href="/#workflow" className="hover:text-[var(--text)]">
            How it works
          </Link>
          <a href="mailto:hello@photopol.us" className="hover:text-[var(--text)]">
            Contact
          </a>
          <Link href="/workspace" className="hover:text-[var(--text)]">
            Get started
          </Link>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-6xl border-t border-[var(--border)] px-4 pt-6 text-xs text-[#71717a] md:px-6">
        © {new Date().getFullYear()} Photopol
      </div>
    </footer>
  );
}
