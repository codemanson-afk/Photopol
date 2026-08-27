import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "Image Resizer",
  description:
    "Resize and crop images to 1:1, 4:5, 16:9, 9:16, or custom dimensions. High-quality export from Photopol.",
  alternates: { canonical: "https://photopol.us/image-resizer" },
};

export default function ImageResizerPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="brand-mark text-4xl text-[var(--text)]">Image Resizer</h1>
        <p className="mt-4 text-lg text-[var(--muted)]">
          Server-side resize and crop with aspect presets for social and product formats. Originals
          stay intact; every change creates a version you can download.
        </p>
        <Link href="/workspace?outcome=ig_ad" className="btn btn-primary mt-10 inline-flex">
          Instagram-ready
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
