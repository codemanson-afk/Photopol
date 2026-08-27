"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function CreateSoonPage() {
  return (
    <AppShell title="Create with AI">
      <div className="fade-in mx-auto max-w-lg space-y-4 py-10 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Create with AI</h1>
        <p className="text-[var(--muted)]">
          Describe the result. Photopol decides whether that means an image, a set, or more — then
          builds it. Same philosophy as Edit Image: you never manage tools.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-4">
          <Link href="/workspace" className="btn btn-primary">
            Edit Image now
          </Link>
          <Link href="/home" className="btn btn-ghost">
            Back to hub
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
