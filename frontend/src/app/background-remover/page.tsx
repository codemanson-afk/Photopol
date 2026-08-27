import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "Background Remover",
  description:
    "Fast background removal for e-commerce and social assets. Part of the Photopol AI image workspace.",
  alternates: { canonical: "https://photopol.us/background-remover" },
};

export default function BackgroundRemoverPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="brand-mark text-4xl text-[var(--text)]">Background Remover</h1>
        <p className="mt-4 text-lg text-[var(--muted)]">
          Remove backgrounds for product listings, creator content, and marketing creatives — then
          continue editing without leaving Photopol.
        </p>
        <Link href="/workspace?outcome=store_ready" className="btn btn-primary mt-10 inline-flex">
          Make store-ready
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
