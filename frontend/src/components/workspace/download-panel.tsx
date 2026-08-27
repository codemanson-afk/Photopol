"use client";

import { MARKETPLACE_SIZE_PRESETS, SOCIAL_SIZE_PRESETS } from "@/lib/tools";

type Props = {
  previewUrl?: string | null;
  width?: number | null;
  height?: number | null;
  format: string;
  onFormat: (v: string) => void;
  onDownload: () => void;
  onExportPack?: (group: "social" | "marketplace") => void;
  onAnother: () => void;
  onBack: () => void;
  busy?: boolean;
  creditsUsed?: number;
  creditsRemaining?: number | null;
};

function HelpTip({
  label,
  blurb,
  lines,
}: {
  label: string;
  blurb?: string;
  lines?: ReadonlyArray<{ label: string; width: number; height: number }>;
}) {
  return (
    <span className="group relative inline-flex shrink-0">
      <button
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)] text-[10px] font-semibold text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        aria-label={`Help: ${label}`}
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-lg border border-[var(--border)] bg-white p-3 text-left text-xs text-[var(--text)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <span className="mb-1 block font-semibold">{label}</span>
        {blurb ? <span className="mb-1.5 block text-[var(--muted)]">{blurb}</span> : null}
        {lines && lines.length > 0 ? (
          <ul className="max-h-40 space-y-0.5 overflow-y-auto text-[var(--muted)]">
            {lines.map((p) => (
              <li key={p.label}>
                {p.label}{" "}
                <span className="tabular-nums">
                  {p.width}×{p.height}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </span>
    </span>
  );
}

export function DownloadPanel({
  previewUrl,
  width,
  height,
  format,
  onFormat,
  onDownload,
  onExportPack,
  onAnother,
  onBack,
  busy,
  creditsUsed = 0,
  creditsRemaining,
}: Props) {
  const dim = width && height ? `${width} × ${height}` : "Original";

  return (
    <div className="fade-in mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8">
      <button
        type="button"
        className="mb-6 self-start text-sm text-[var(--muted)] hover:text-[var(--text)]"
        onClick={onBack}
      >
        ← Back to Edit
      </button>

      <div className="grid flex-1 gap-8 md:grid-cols-2 md:items-start">
        <div className="ba-check flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-[var(--border)]">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Result" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-sm text-[var(--muted)]">No preview</span>
          )}
        </div>

        <div className="card flex flex-col gap-4 p-6">
          <h1 className="text-2xl font-bold">Download your image</h1>
          <p className="text-sm text-[var(--muted)]">Size: {dim}</p>

          <div>
            <label className="mb-1.5 block text-sm text-[var(--muted)]">Format</label>
            <select className="input" value={format} onChange={(e) => onFormat(e.target.value)}>
              <option value="png">PNG (Recommended)</option>
              <option value="jpg">JPG</option>
              <option value="webp">WEBP</option>
            </select>
          </div>

          <button
            type="button"
            className="btn btn-primary mt-2 min-h-12 w-full"
            disabled={busy || !previewUrl}
            onClick={onDownload}
          >
            {busy ? "Preparing…" : "Download Image"}
          </button>

          {onExportPack && (
            <div className="rounded-xl border border-[var(--border)] bg-[#fafafa] p-4">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-[var(--text)]">Size packs</p>
                <HelpTip
                  label="Size packs"
                  blurb="One ZIP from your current result, resized for each platform. Uses the format above. Social crops to fill; marketplace fits inside (no stretch)."
                />
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Multi-size ZIP for social or marketplace.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <div className="flex flex-1 items-center gap-1.5">
                  <button
                    type="button"
                    className="btn btn-ghost min-h-11 flex-1 text-sm"
                    disabled={busy || !previewUrl}
                    onClick={() => onExportPack("social")}
                  >
                    Social sizes (ZIP)
                  </button>
                  <HelpTip
                    label="Social sizes"
                    blurb="IG, TikTok, YouTube, LinkedIn, X, FB, Pinterest"
                    lines={SOCIAL_SIZE_PRESETS}
                  />
                </div>
                <div className="flex flex-1 items-center gap-1.5">
                  <button
                    type="button"
                    className="btn btn-ghost min-h-11 flex-1 text-sm"
                    disabled={busy || !previewUrl}
                    onClick={() => onExportPack("marketplace")}
                  >
                    Marketplace sizes (ZIP)
                  </button>
                  <HelpTip
                    label="Marketplace sizes"
                    blurb="Amazon, Shopify, Etsy, eBay — product-safe fit"
                    lines={MARKETPLACE_SIZE_PRESETS}
                  />
                </div>
              </div>
            </div>
          )}

          <button type="button" className="btn btn-ghost min-h-11 w-full" onClick={onAnother}>
            Edit another image
          </button>

          <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="font-semibold text-emerald-700">
              {creditsUsed > 0
                ? `${creditsUsed} credit${creditsUsed === 1 ? "" : "s"} used`
                : "Ready to download"}
            </div>
            {creditsRemaining != null && (
              <div className="text-sm text-[var(--muted)]">{creditsRemaining} credits remaining</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
