import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "AI Image Upscaler",
  description: "2× and 4× image upscaling in Photopol.",
  alternates: { canonical: "https://photopol.us/image-upscaler" },
  openGraph: {
    title: "AI Image Upscaler | Photopol",
    description: "Dedicated upscale for sharper exports.",
    url: "https://photopol.us/image-upscaler",
  },
};

export default function ImageUpscalerPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="brand-mark text-4xl text-[var(--text)]">AI Image Upscaler</h1>
        <p className="mt-4 text-lg text-[var(--muted)]">
          Upscale 2× on Free, or 4× on Pro — then crop, resize, and download from one workspace.
        </p>
        <ul className="mt-8 list-disc space-y-2 pl-5 text-[var(--muted)]">
          <li>2× and 4× scales</li>
          <li>Dimension guards</li>
          <li>Same project history</li>
        </ul>
        <Link href="/workspace?outcome=professional" className="btn btn-primary mt-10 inline-flex">
          Look professional
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
