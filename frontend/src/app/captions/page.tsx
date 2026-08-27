"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function CaptionsSoonPage() {
  return (
    <AppShell title="AI Captions">
      <div className="fade-in mx-auto max-w-lg space-y-4 py-10 text-center">
        <h1 className="text-2xl font-bold tracking-tight">AI Captions</h1>
        <p className="text-[var(--muted)]">
          Upload video → ASR → styled captions burned in. Multi-language + templates later.
        </p>
        <Link href="/home" className="btn btn-primary inline-flex">
          Back to hub
        </Link>
      </div>
    </AppShell>
  );
}
