"use client";

import { LIVE_TOOLS, ASPECT_PRESETS, type ToolId } from "@/lib/tools";

type Props = {
  tool: ToolId;
  onTool: (id: ToolId) => void;
  aspect: string;
  onAspect: (a: string) => void;
  width: number;
  height: number;
  onWidth: (n: number) => void;
  onHeight: (n: number) => void;
  cropAspect: string;
  onCropAspect: (a: string) => void;
  onApply: () => void;
  busy: boolean;
  disabled?: boolean;
  cost: number;
  isGuest?: boolean;
  compact?: boolean;
};

export function ToolSheet({
  tool,
  onTool,
  aspect,
  onAspect,
  width,
  height,
  onWidth,
  onHeight,
  cropAspect,
  onCropAspect,
  onApply,
  busy,
  disabled,
  cost,
  isGuest,
  compact,
}: Props) {
  return (
    <div
      className={
        compact
          ? "flex max-h-[42vh] flex-col gap-3 overflow-y-auto rounded-2xl border border-[var(--border)] bg-white p-3 shadow-[var(--shadow-soft)]"
          : "flex h-full flex-col gap-5 border-r border-[var(--border)] bg-white p-4 md:p-5"
      }
    >
      <div>
        {!compact && <h2 className="text-lg font-semibold">Edit Image</h2>}
        <label className={`mb-1.5 block text-xs font-medium text-[var(--muted)] ${compact ? "" : "mt-4"}`}>
          Tool
        </label>
        <select
          className="input"
          value={tool}
          onChange={(e) => onTool(e.target.value as ToolId)}
        >
          {LIVE_TOOLS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {tool === "resize" && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--muted)]">Aspect</p>
          <div className="flex flex-wrap gap-1.5">
            {ASPECT_PRESETS.map((a) => (
              <button
                key={a}
                type="button"
                className={`min-h-9 rounded-lg border px-2.5 text-xs ${
                  aspect === a
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                    : "border-[var(--border)] text-[var(--muted)]"
                }`}
                onClick={() => onAspect(a)}
              >
                {a}
              </button>
            ))}
            <button
              type="button"
              className={`min-h-9 rounded-lg border px-2.5 text-xs ${
                aspect === "custom"
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                  : "border-[var(--border)] text-[var(--muted)]"
              }`}
              onClick={() => onAspect("custom")}
            >
              Custom
            </button>
          </div>
          {aspect === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input"
                type="number"
                min={16}
                value={width}
                onChange={(e) => onWidth(Number(e.target.value))}
                placeholder="W"
              />
              <input
                className="input"
                type="number"
                min={16}
                value={height}
                onChange={(e) => onHeight(Number(e.target.value))}
                placeholder="H"
              />
            </div>
          )}
        </div>
      )}

      {tool === "crop" && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--muted)]">Crop aspect</p>
          <div className="flex flex-wrap gap-1.5">
            {ASPECT_PRESETS.map((a) => (
              <button
                key={a}
                type="button"
                className={`min-h-9 rounded-lg border px-2.5 text-xs ${
                  cropAspect === a
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                    : "border-[var(--border)] text-[var(--muted)]"
                }`}
                onClick={() => onCropAspect(a)}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary w-full"
        disabled={busy || disabled}
        onClick={onApply}
      >
        {busy ? "Working…" : "Apply"}
      </button>
      <p className="text-xs text-[var(--muted)]">
        {isGuest ? "Free to try · sign in to download" : `${cost} credit${cost === 1 ? "" : "s"}`}
      </p>

      {/* Disabled mockup extras — desktop only */}
      {!compact && (
        <>
          <div className="soon-block space-y-4 border-t border-[var(--border)] pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Brush</p>
              <span className="text-[10px] text-[var(--muted)]">Soon</span>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost min-h-10 flex-1 text-xs" tabIndex={-1}>
                Brush
              </button>
              <button type="button" className="btn btn-ghost min-h-10 flex-1 text-xs" tabIndex={-1}>
                Eraser
              </button>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-[var(--muted)]">
                <span>Brush Size</span>
                <span>40px</span>
              </div>
              <input type="range" className="w-full accent-[var(--accent)]" defaultValue={40} tabIndex={-1} />
            </div>
          </div>

          <div className="soon-block space-y-3 border-t border-[var(--border)] pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Background
              </p>
              <span className="text-[10px] text-[var(--muted)]">Soon</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-ghost min-h-10 flex-1 border-[var(--accent)] text-xs"
                tabIndex={-1}
              >
                Transparent
              </button>
              <button type="button" className="btn btn-ghost min-h-10 flex-1 text-xs" tabIndex={-1}>
                Color
              </button>
            </div>
            <div className="flex gap-1.5">
              {["#ffffff", "#1e3a5f", "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6"].map((c) => (
                <span
                  key={c}
                  className="h-7 w-7 rounded-md border border-[var(--border)]"
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          <div className="soon-block space-y-3 border-t border-[var(--border)] pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Image settings
              </p>
              <span className="text-[10px] text-[var(--muted)]">Soon</span>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-[var(--muted)]">
                <span>Brightness</span>
                <span>0</span>
              </div>
              <input type="range" className="w-full accent-[var(--accent)]" defaultValue={0} tabIndex={-1} />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-[var(--muted)]">
                <span>Contrast</span>
                <span>0</span>
              </div>
              <input type="range" className="w-full accent-[var(--accent)]" defaultValue={0} tabIndex={-1} />
            </div>
            <button type="button" className="btn btn-ghost w-full text-sm" tabIndex={-1}>
              Reset
            </button>
          </div>
        </>
      )}
    </div>
  );
}
