"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function CreateVideoSoonPage() {
  return (
    <AppShell title="Create Video">
      <div className="fade-in mx-auto max-w-lg space-y-4 py-10 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Create Video</h1>
        <p className="text-[var(--muted)]">
          Duration tiers + TikTok / Reels / Shorts / YT presets. Drama/story focus — not slideshows.
          After the image system.
        </p>
        <Link href="/home" className="btn btn-primary inline-flex">
          Back to hub
        </Link>
      </div>
    </AppShell>
  );
}
