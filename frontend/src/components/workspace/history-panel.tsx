"use client";

import type { ImageVersion } from "@/lib/types";

type Props = {
  versions: ImageVersion[];
  activeId?: string | null;
  onSelect: (id: string) => void;
  className?: string;
  compact?: boolean;
};

export function HistoryPanel({ versions, activeId, onSelect, className = "", compact }: Props) {
  const sorted = [...versions].reverse();

  return (
    <div
      className={`flex flex-col bg-white ${
        compact ? "border-0 p-0" : "h-full border-l border-[var(--border)] p-4 md:p-5"
      } ${className}`}
    >
      {!compact && <h2 className="text-lg font-semibold">History</h2>}
      <div className={`${compact ? "mt-0 max-h-48" : "mt-4 flex-1"} space-y-2 overflow-y-auto`}>
        {sorted.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No versions yet</p>
        ) : (
          sorted.map((v) => {
            const active = v.id === activeId;
            const label =
              v.kind === "ORIGINAL"
                ? "Original Image"
                : v.operation === "background_removal" || v.operation === "remove_bg"
                  ? "Background Removed"
                  : v.operation
                    ? v.operation.replace(/_/g, " ")
                    : "Processed";
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onSelect(v.id)}
                className={`flex w-full gap-3 rounded-xl border p-2.5 text-left transition ${
                  active
                    ? "border-[var(--accent)]/40 bg-[var(--accent-soft)]"
                    : "border-[var(--border)] hover:border-[var(--border-strong)]"
                }`}
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[#eef0f5]">
                  {v.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.url} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={`truncate text-sm font-medium capitalize ${
                      active ? "text-[var(--accent-strong)]" : ""
                    }`}
                  >
                    {label}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--muted)]">
                    {new Date(v.created_at).toLocaleString()}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
