"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  beforeSrc: string;
  afterSrc: string;
  className?: string;
};

export function HeroCompare({ beforeSrc, afterSrc, className = "" }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(52);
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

  return (
    <div
      ref={wrapRef}
      className={`relative touch-none select-none overflow-hidden rounded-2xl border border-[var(--border)] bg-[#eef0f5] shadow-[var(--shadow-soft)] ${className}`}
      onPointerDown={(e) => {
        dragging.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        setFromClientX(e.clientX);
      }}
      role="img"
      aria-label="Before and after portrait"
    >
      <div className="relative h-full w-full">
        <div className="absolute inset-0 bg-[#e8e8ec]" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={beforeSrc}
            alt="Before"
            className="absolute inset-0 h-full w-full object-cover object-top"
            draggable={false}
          />
        </div>

        <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
          <div className="ba-check absolute inset-0" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={afterSrc}
            alt="After"
            className="absolute inset-0 h-full w-full object-cover object-top"
            draggable={false}
          />
        </div>

        <div
          className="pointer-events-none absolute bottom-0 top-0 z-10 w-0.5 bg-[var(--accent)]"
          style={{ left: `${pos}%` }}
        />
        <div
          className="pointer-events-none absolute top-1/2 z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[var(--accent)] bg-white text-xs font-bold text-[var(--accent)] shadow-md"
          style={{ left: `${pos}%` }}
        >
          ‹ ›
        </div>
        <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-black/40 px-2 py-1 text-[11px] text-white">
          Before
        </span>
        <span className="pointer-events-none absolute right-3 top-3 z-10 rounded-full bg-black/40 px-2 py-1 text-[11px] text-white">
          After
        </span>
      </div>
    </div>
  );
}
