"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { LIVE_TOOLS, type ToolId } from "@/lib/tools";
import { CAPABILITY_GROUPS, capabilityForTool, type CapabilityId } from "@/lib/capabilities";
import { BeforeAfter } from "@/components/workspace/before-after";
import { EraseStage } from "@/components/workspace/erase-stage";
import { ToolOptionsPanel, type LiveToolOptions } from "@/components/workspace/tool-options-panel";
import type { ImageVersion } from "@/lib/types";

const TOOL_META: Record<
  ToolId,
  { label: string; short: string; hint: string; icon: ReactNode }
> = {
  remove_bg: {
    label: "Cutout",
    short: "Cutout",
    hint: "Remove the background in one click. Transparent PNG ready to download.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 7a3 3 0 013-3h4l2 2h5a3 3 0 013 3v9a3 3 0 01-3 3H7a3 3 0 01-3-3V7z"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <path d="M9 14l2 2 4-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  object_remove: {
    label: "Erase",
    short: "Erase",
    hint: "Paint left · see result right. Brush size in options.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 20h8l10-10-4-4L8 16v4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M14 6l4 4" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    ),
  },
  upscale: {
    label: "Upscale",
    short: "Upscale",
    hint: "Dedicated 2× / 4× upscale for sharper exports.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 14v6h6M20 10V4h-6M14 4l6 6M10 20l-6-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  enhance: {
    label: "Enhance",
    short: "Enhance",
    hint: "Auto contrast, color, and sharpen.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  bg_replace: {
    label: "Replace",
    short: "Replace",
    hint: "Cut out the subject and place on a solid color (Pro).",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    ),
  },
  resize: {
    label: "Resize",
    short: "Resize",
    hint: "Scale to a preset ratio or set custom width and height.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M8 4H5a1 1 0 00-1 1v3M16 4h3a1 1 0 011 1v3M8 20H5a1 1 0 01-1-1v-3M16 20h3a1 1 0 001-1v-3"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  crop: {
    label: "Crop",
    short: "Crop",
    hint: "Frame the shot to the aspect ratio you need.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M6 3v15a1 1 0 001 1h15M3 6h15a1 1 0 011 1v15"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
};

type Props = {
  tool: ToolId;
  onTool: (id: ToolId) => void;
  liveOptions: LiveToolOptions;
  /** Erase: paint canvas (left of side-by-side stage) */
  eraseImageUrl?: string | null;
  onMaskReady?: (blob: Blob | null) => void;
  onApply: () => void;
  onDownload: () => void;
  onProductPipeline?: () => void;
  onNewUpload: () => void;
  onBack: () => void;
  busy: boolean;
  disabled?: boolean;
  cost: number;
  isGuest?: boolean;
  beforeUrl?: string | null;
  afterUrl?: string | null;
  processing?: string | null;
  canDownload: boolean;
  thumbUrl?: string | null;
  versions: ImageVersion[];
  activeVersionId?: string | null;
  onSelectVersion: (id: string) => void;
  showCompare: boolean;
  onToggleCompare: () => void;
  /** Credits charged on this image during the current editing session */
  sessionCredits?: number;
  topRight?: ReactNode;
  error?: ReactNode;
};

export function StudioEditor({
  tool,
  onTool,
  liveOptions,
  eraseImageUrl,
  onMaskReady,
  onApply,
  onDownload,
  onProductPipeline,
  onNewUpload,
  onBack,
  busy,
  disabled,
  cost,
  isGuest,
  beforeUrl,
  afterUrl,
  processing,
  canDownload,
  thumbUrl,
  versions,
  activeVersionId,
  onSelectVersion,
  showCompare,
  onToggleCompare,
  sessionCredits = 0,
  topRight,
  error,
}: Props) {
  const meta = TOOL_META[tool];
  const optionsScrollRef = useRef<HTMLDivElement>(null);
  const mobileOptionsScrollRef = useRef<HTMLDivElement>(null);
  const capability = capabilityForTool(tool);
  const groupTools = useMemo(() => {
    const ids = CAPABILITY_GROUPS.find((g) => g.id === capability)?.tools ?? [];
    return LIVE_TOOLS.filter((t) => ids.includes(t.id));
  }, [capability]);

  useEffect(() => {
    if (optionsScrollRef.current) optionsScrollRef.current.scrollTop = 0;
    if (mobileOptionsScrollRef.current) mobileOptionsScrollRef.current.scrollTop = 0;
  }, [tool]);

  function selectCapability(id: CapabilityId) {
    const first = CAPABILITY_GROUPS.find((g) => g.id === id)?.tools[0];
    if (first) onTool(first);
  }

  // Always show session strip (0 is fine — honesty)
  const sessionStrip = (
    <p className="text-[11px] text-[var(--muted)]">
      This image · session credits used:{" "}
      <span className="font-semibold text-[var(--text)]">{sessionCredits}</span>
    </p>
  );

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] flex-col bg-[#f0f0f3]">
      {/* Top toolbar */}
      <header className="z-20 flex shrink-0 items-center gap-2 px-3 py-3 md:px-4">
        <button
          type="button"
          onClick={onBack}
          className="brand-mark hidden text-lg text-[var(--text)] sm:inline md:mr-2"
        >
          Photopol
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl px-2 py-2 text-sm text-[var(--muted)] hover:bg-white sm:hidden"
        >
          ←
        </button>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
          {sessionStrip}
          <div className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl border border-[var(--border)] bg-white p-1 shadow-[var(--shadow-card)]">
            {CAPABILITY_GROUPS.map((g) => {
              const active = capability === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => selectCapability(g.id)}
                  className={`flex shrink-0 items-center rounded-xl px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-[#f3f3f6] text-[var(--text)]"
                      : "text-[var(--muted)] hover:bg-[#fafafa] hover:text-[var(--text)]"
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
            <div className="mx-1 hidden h-6 w-px bg-[var(--border)] sm:block" />
            {groupTools.map((t) => {
              const m = TOOL_META[t.id];
              const active = tool === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTool(t.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                      : "text-[var(--muted)] hover:bg-[#fafafa] hover:text-[var(--text)]"
                  }`}
                  title={m?.hint}
                >
                  <span>{m?.icon}</span>
                  <span className="hidden md:inline">{m?.short || t.label}</span>
                </button>
              );
            })}
            <div className="mx-1 hidden h-6 w-px bg-[var(--border)] sm:block" />
            <button
              type="button"
              onClick={onToggleCompare}
              disabled={!afterUrl}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition disabled:opacity-40 ${
                showCompare
                  ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                  : "text-[var(--muted)] hover:bg-[#fafafa]"
              }`}
              title="Compare before / after"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="3" y="5" width="8" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
                <rect x="13" y="5" width="8" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
              </svg>
              <span className="hidden md:inline">Compare</span>
            </button>
            <button
              type="button"
              onClick={onDownload}
              disabled={!canDownload}
              className="btn btn-primary ml-1 min-h-9 shrink-0 gap-1.5 rounded-xl px-3 text-sm disabled:opacity-40"
            >
              Done
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 4v12M6 12l6 6 6-6M5 20h14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="hidden shrink-0 sm:block">{topRight}</div>
      </header>

      {/* Stage + right panel */}
      <div className="flex min-h-0 flex-1 gap-3 px-3 pb-2 md:px-4 lg:gap-4">
        <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-[#e8e8ec] shadow-[var(--shadow-card)]">
          {error && <div className="absolute left-3 right-3 top-3 z-20">{error}</div>}
          <div className="flex min-h-0 flex-1 items-center justify-center p-3 md:p-6">
            {tool === "object_remove" && eraseImageUrl && onMaskReady ? (
              <EraseStage
                imageUrl={eraseImageUrl}
                resultUrl={afterUrl}
                brush={liveOptions.brushSize}
                processing={processing}
                onMaskReady={onMaskReady}
              />
            ) : (
              <BeforeAfter
                beforeUrl={showCompare ? beforeUrl : afterUrl || beforeUrl}
                afterUrl={showCompare ? afterUrl : null}
                processing={processing}
                className="max-h-full w-full max-w-4xl !border-0 !bg-transparent !shadow-none"
              />
            )}
          </div>
        </section>

        <aside className="hidden w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)] lg:flex xl:w-[320px]">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-base font-semibold">{meta.label}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{meta.hint}</p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <div ref={optionsScrollRef} className="flex-1 overflow-y-auto p-5">
              <ToolOptionsPanel
                tool={tool}
                live={liveOptions}
              />

              {onProductPipeline && tool === "remove_bg" && (
                <div className="mt-5 rounded-xl border border-dashed border-[var(--border)] bg-[#fafafa] p-3">
                  <p className="mt-0 text-xs leading-relaxed text-[var(--muted)]">
                    Cutout · clean BG · enhance · shop ZIP
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-sm font-semibold text-[var(--accent)] hover:underline disabled:opacity-40"
                    disabled={busy || disabled}
                    onClick={onProductPipeline}
                  >
                    Make marketplace-ready →
                  </button>
                </div>
              )}
            </div>
            <div className="shrink-0 border-t border-[var(--border)] p-5">
              <button
                type="button"
                className="btn btn-primary w-full min-h-11"
                disabled={busy || disabled}
                onClick={onApply}
              >
                {busy ? "Working…" : `Apply ${meta.short}${isGuest ? "" : ` · ${cost} cr`}`}
              </button>
              {isGuest && (
                <p className="mt-2 text-center text-xs text-[var(--muted)]">
                  Free to try · sign in to download
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile tool controls */}
      <div className="border-t border-[var(--border)] bg-white px-3 py-3 lg:hidden">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{meta.label}</p>
          <button
            type="button"
            className="btn btn-primary min-h-9 px-4 text-sm"
            disabled={busy || disabled}
            onClick={onApply}
          >
            {busy ? "…" : "Apply"}
          </button>
        </div>
        <div ref={mobileOptionsScrollRef} className="max-h-[38vh] overflow-y-auto pr-1">
          <ToolOptionsPanel
            tool={tool}
            compact
            showExport={false}
            live={liveOptions}
          />
          {onProductPipeline && tool === "remove_bg" && (
            <button
              type="button"
              className="mt-3 text-sm font-semibold text-[var(--accent)]"
              disabled={busy || disabled}
              onClick={onProductPipeline}
            >
              Make marketplace-ready →
            </button>
          )}
        </div>
      </div>

      {/* Bottom tray */}
      <div className="flex shrink-0 items-center justify-center gap-2 px-3 pb-3 pt-1 md:pb-4">
        <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-2 py-2 shadow-[var(--shadow-card)]">
          <button
            type="button"
            onClick={onNewUpload}
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f3f3f6] text-xl text-[var(--muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
            title="Upload another"
          >
            +
          </button>
          {(thumbUrl || beforeUrl) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbUrl || beforeUrl || ""}
              alt=""
              className="h-12 w-12 rounded-xl object-cover ring-2 ring-[var(--accent)]"
            />
          )}
          {versions
            .filter((v) => v.kind === "PROCESSED")
            .slice(-3)
            .map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => onSelectVersion(v.id)}
                className={`h-12 w-12 overflow-hidden rounded-xl ${
                  v.id === activeVersionId ? "ring-2 ring-[var(--accent)]" : "opacity-80 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {v.url ? <img src={v.url} alt="" className="h-full w-full object-cover" /> : null}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
