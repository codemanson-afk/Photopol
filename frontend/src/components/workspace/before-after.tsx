"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  beforeUrl?: string | null;
  afterUrl?: string | null;
  processing?: string | null;
  className?: string;
  beforeLabel?: string;
  afterLabel?: string;
  /** Fill parent height instead of fixed aspect box */
  fill?: boolean;
};

export function BeforeAfter({
  beforeUrl,
  afterUrl,
  processing,
  className = "",
  beforeLabel = "Before",
  afterLabel = "After",
  fill = false,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);
  const dragging = useRef(false);

  const setFromClientX = useCallback((clientX: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    setPos((x / rect.width) * 100);
  }, []);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!dragging.current) return;
      setFromClientX(e.clientX);
    }
    function onUp() {
      dragging.current = false;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [setFromClientX]);

  useEffect(() => {
    if (afterUrl) setPos(50);
  }, [afterUrl]);

  if (!beforeUrl) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-[var(--border)] bg-[#eef0f5] ${
          fill ? "h-full min-h-0" : "min-h-[280px]"
        } ${className}`}
      >
        <p className="text-sm text-[var(--muted)]">Your image appears here</p>
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      className={`relative touch-none overflow-hidden rounded-2xl border border-[var(--border)] bg-[#e8e8ec] shadow-[var(--shadow-card)] reveal ${
        fill ? "h-full min-h-0" : ""
      } ${className}`}
      onPointerDown={(e) => {
        if (!afterUrl) return;
        dragging.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        setFromClientX(e.clientX);
      }}
    >
      <div
        className={
          fill
            ? "absolute inset-0"
            : "relative mx-auto aspect-[4/3] w-full max-h-[min(70vh,640px)]"
        }
      >
        {/* Before — left */}
        <div
          className="absolute inset-0 bg-[#e8e8ec]"
          style={afterUrl ? { clipPath: `inset(0 ${100 - pos}% 0 0)` } : undefined}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={beforeUrl}
            alt="Before"
            className="absolute inset-0 h-full w-full object-contain"
            draggable={false}
          />
        </div>

        {afterUrl && (
          <>
            <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
              <div className="ba-check absolute inset-0" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={afterUrl}
                alt="After"
                className="absolute inset-0 h-full w-full object-contain"
                draggable={false}
              />
            </div>
            <div
              className="pointer-events-none absolute bottom-0 top-0 z-10 w-0.5 bg-[var(--accent)]"
              style={{ left: `${pos}%` }}
            />
            <div
              className="pointer-events-none absolute top-1/2 z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-[0_4px_14px_rgba(139,92,246,0.45)]"
              style={{ left: `${pos}%` }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M8 6l-4 6 4 6M16 6l4 6-4 6"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
              {beforeLabel}
            </span>
            <span className="pointer-events-none absolute right-3 top-3 z-10 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
              {afterLabel}
            </span>
          </>
        )}

        {processing && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/70">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-black/10 border-t-[var(--accent)]" />
            <p className="mt-3 text-sm font-medium text-[var(--accent-strong)]">{processing}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export const BeforeAfterPreview = BeforeAfter;
