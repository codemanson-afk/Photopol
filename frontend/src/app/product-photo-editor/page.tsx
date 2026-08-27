import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "Product Photo Editor — Photopol",
  description: "Make product photos marketplace-ready: cutout, studio background, enhance, shop sizes.",
  alternates: { canonical: "https://photopol.us/product-photo-editor" },
  openGraph: {
    title: "Product Photo Editor — Photopol",
    description: "Turn phone snaps into Amazon / Shopify / Etsy ready packs.",
    url: "https://photopol.us/product-photo-editor",
  },
};

export default function ProductPhotoEditorPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16 md:px-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">Product workflow</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-[var(--text)]">
          Product photos, marketplace-ready
        </h1>
        <p className="mt-4 text-lg text-[#4a5568]">
          Cut out the subject, place on a clean studio background with optional shadow, enhance, then export Amazon,
          Shopify, Etsy, and eBay sizes as a ZIP — all inside Edit Image.
        </p>
        <ul className="mt-8 space-y-2 text-[#4a5568]">
          <li>· Cutout → white/studio BG → enhance</li>
          <li>· Marketplace size pack (Amazon, Shopify, Etsy, eBay)</li>
          <li>· Same Photopol workspace — no re-upload</li>
        </ul>
        <Link href="/workspace?outcome=store_ready" className="btn btn-primary mt-10 inline-flex">
          Make store-ready
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
