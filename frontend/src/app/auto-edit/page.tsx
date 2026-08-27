"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Auto Edit is folded into Edit Image (intent outcomes). */
export default function AutoEditRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/workspace");
  }, [router]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--muted)]">
      Opening Edit Image…
    </div>
  );
}
