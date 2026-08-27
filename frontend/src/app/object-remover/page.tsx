import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "AI Object Remover",
  description: "Brush away unwanted objects from photos with Photopol erase.",
  alternates: { canonical: "https://photopol.us/object-remover" },
  openGraph: {
    title: "AI Object Remover | Photopol",
    description: "Paint a mask and remove objects in one workspace.",
    url: "https://photopol.us/object-remover",
  },
};

export default function ObjectRemoverPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="brand-mark text-4xl text-[var(--text)]">AI Object Remover</h1>
        <p className="mt-4 text-lg text-[var(--muted)]">
          Brush over distractions — Photopol erases them and keeps you in the same editor for export.
        </p>
        <ul className="mt-8 list-disc space-y-2 pl-5 text-[var(--muted)]">
          <li>Brush mask erase</li>
          <li>Version history</li>
          <li>Credits only after success</li>
        </ul>
        <Link href="/workspace?outcome=professional" className="btn btn-primary mt-10 inline-flex">
          Look professional
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
