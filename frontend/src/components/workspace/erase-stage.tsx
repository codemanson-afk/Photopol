"use client";

import { MaskCanvas } from "@/components/workspace/mask-canvas";

type Props = {
  imageUrl: string;
  resultUrl?: string | null;
  brush: number;
  processing?: string | null;
  onMaskReady: (blob: Blob | null) => void;
};

/** Side-by-side: paint mask left, result right. */
export function EraseStage({ imageUrl, resultUrl, brush, processing, onMaskReady }: Props) {
  return (
    <div className="grid h-full max-h-full w-full max-w-6xl grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
      <div className="flex min-h-0 flex-col">
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Paint
        </p>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-[#dedee4]/60 p-2">
          <MaskCanvas imageUrl={imageUrl} brush={brush} onMaskReady={onMaskReady} />
        </div>
      </div>

      <div className="flex min-h-0 flex-col">
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Result
        </p>
        <div className="relative flex min-h-[220px] flex-1 items-center justify-center overflow-hidden rounded-xl bg-[#dedee4]/60 p-2 md:min-h-0">
          {processing ? (
            <div className="flex flex-col items-center gap-2 px-4 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
              <p className="text-sm text-[var(--muted)]">{processing}</p>
            </div>
          ) : resultUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resultUrl}
              alt="Erase result"
              className="max-h-[min(70vh,720px)] w-auto max-w-full object-contain"
            />
          ) : (
            <div className="px-6 text-center">
              <p className="text-sm font-medium text-[var(--text)]">Result appears here</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Paint on the left, then Apply
              </p>
              {/* faint original as reference */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt=""
                className="mx-auto mt-4 max-h-[40vh] w-auto max-w-full object-contain opacity-25"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
