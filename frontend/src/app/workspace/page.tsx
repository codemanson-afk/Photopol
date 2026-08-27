import { Suspense } from "react";
import WorkspacePage from "./workspace-client";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="bg-mesh flex min-h-screen items-center justify-center text-[var(--muted)]">
          Loading workspace…
        </div>
      }
    >
      <WorkspacePage />
    </Suspense>
  );
}
