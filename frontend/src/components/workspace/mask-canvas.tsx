"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  imageUrl: string;
  brush: number;
  onMaskReady: (blob: Blob | null) => void;
};

/**
 * Brush mask: photo underneath; paint shows as translucent accent.
 * Export mask is black + white strokes (white = erase).
 */
export function MaskCanvas({ imageUrl, brush, onMaskReady }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hasPaint, setHasPaint] = useState(false);

  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const max = 1400;
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      setSize({ w, h });

      const overlay = overlayRef.current;
      if (!overlay) return;
      overlay.width = w;
      overlay.height = h;
      const octx = overlay.getContext("2d")!;
      octx.clearRect(0, 0, w, h);

      const mask = document.createElement("canvas");
      mask.width = w;
      mask.height = h;
      const mctx = mask.getContext("2d")!;
      mctx.fillStyle = "#000";
      mctx.fillRect(0, 0, w, h);
      maskRef.current = mask;

      setHasPaint(false);
      onMaskReady(null);
    };
    img.src = imageUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  function paint(e: React.PointerEvent) {
    const overlay = overlayRef.current;
    const mask = maskRef.current;
    if (!overlay || !mask) return;

    const rect = overlay.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * overlay.width;
    const y = ((e.clientY - rect.top) / rect.height) * overlay.height;

    const octx = overlay.getContext("2d")!;
    octx.fillStyle = "rgba(139, 92, 246, 0.55)";
    octx.beginPath();
    octx.arc(x, y, brush, 0, Math.PI * 2);
    octx.fill();

    const mctx = mask.getContext("2d")!;
    mctx.fillStyle = "#fff";
    mctx.beginPath();
    mctx.arc(x, y, brush, 0, Math.PI * 2);
    mctx.fill();
    setHasPaint(true);
  }

  async function exportMask() {
    const mask = maskRef.current;
    if (!mask) return;
    const blob = await new Promise<Blob | null>((resolve) => mask.toBlob(resolve, "image/png"));
    onMaskReady(blob);
  }

  function clearMask() {
    const overlay = overlayRef.current;
    const mask = maskRef.current;
    if (!overlay || !mask) return;
    const octx = overlay.getContext("2d")!;
    octx.clearRect(0, 0, overlay.width, overlay.height);
    const mctx = mask.getContext("2d")!;
    mctx.fillStyle = "#000";
    mctx.fillRect(0, 0, mask.width, mask.height);
    setHasPaint(false);
    onMaskReady(null);
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      <div
        className="relative mx-auto w-full overflow-hidden"
        style={{ aspectRatio: size.w && size.h ? `${size.w}/${size.h}` : "4/3" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        />
        <canvas
          ref={overlayRef}
          className="absolute inset-0 z-10 h-full w-full cursor-crosshair touch-none"
          onPointerDown={(e) => {
            drawing.current = true;
            (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
            paint(e);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            paint(e);
          }}
          onPointerUp={() => {
            drawing.current = false;
            void exportMask();
          }}
        />
        {hasPaint && (
          <button
            type="button"
            className="absolute bottom-2 right-2 z-20 rounded-lg bg-white/95 px-2.5 py-1 text-[11px] font-medium text-[var(--text)] shadow-sm hover:bg-white"
            onClick={clearMask}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
