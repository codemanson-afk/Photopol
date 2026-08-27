import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "AI Background Remover",
  description:
    "Remove image backgrounds with Photopol AI. Upload once, preview before/after, then resize, crop, and export.",
  alternates: { canonical: "https://photopol.us/ai-background-remover" },
  openGraph: {
    title: "AI Background Remover | Photopol",
    description: "Real AI background removal in one image workspace.",
    url: "https://photopol.us/ai-background-remover",
  },
};

export default function AiBackgroundRemoverPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="brand-mark text-4xl text-[var(--text)]">AI Background Remover</h1>
        <p className="mt-4 text-lg text-[var(--muted)]">
          Clean product and portrait cutouts without bouncing between tools. Photopol uses real AI
          background removal, then keeps you in the same workspace for crop, resize, and export.
        </p>
        <ul className="mt-8 list-disc space-y-2 pl-5 text-[var(--muted)]">
          <li>Upload JPG, PNG, or WEBP</li>
          <li>Before/after preview</li>
          <li>Transparent PNG download</li>
          <li>Credits only deducted after successful processing</li>
        </ul>
        <Link href="/workspace?outcome=store_ready" className="btn btn-primary mt-10 inline-flex">
          Make store-ready
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
