"use client";

import type { ReactNode } from "react";
import type { OutcomeAnalysis, OutcomeCard } from "@/lib/tools";
import type { OutcomeId } from "@/lib/outcomes";

type Props = {
  previewUrl: string | null;
  afterUrl?: string | null;
  analysis: OutcomeAnalysis | null;
  analyzing: boolean;
  selected: OutcomeId | null;
  onSelect: (id: OutcomeId) => void;
  customText: string;
  onCustomText: (v: string) => void;
  busy: boolean;
  status?: string;
  sessionCredits: number;
  creditsBalance: number | null;
  isGuest?: boolean;
  lastImproved?: string[];
  onRun: () => void;
  onDone: () => void;
  onChooseAgain: () => void;
  onAdvanced: () => void;
  onNewUpload: () => void;
  onBack: () => void;
  topRight?: ReactNode;
  error?: ReactNode;
  phase: "choose" | "result";
};

function OutcomeButton({
  card,
  active,
  onClick,
  disabled,
}: {
  card: OutcomeCard;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[var(--shadow-card)]"
          : "border-[var(--border)] bg-white hover:border-[var(--accent)]/40"
      } disabled:opacity-50`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[var(--text)]">{card.label}</span>
            {card.recommended && (
              <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold text-white">
                Recommended
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">{card.blurb}</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {card.improves.slice(0, 4).map((x) => (
              <li
                key={x}
                className="rounded-full bg-[#f3f3f6] px-2 py-0.5 text-[11px] text-[var(--muted)]"
              >
                {x}
              </li>
            ))}
          </ul>
        </div>
        <span className="shrink-0 text-xs font-medium text-[var(--accent)]">{card.credits} cr</span>
      </div>
    </button>
  );
}

export function IntentWorkspace({
  previewUrl,
  afterUrl,
  analysis,
  analyzing,
  selected,
  onSelect,
  customText,
  onCustomText,
  busy,
  status,
  sessionCredits,
  creditsBalance,
  isGuest,
  lastImproved,
  onRun,
  onDone,
  onChooseAgain,
  onAdvanced,
  onNewUpload,
  onBack,
  topRight,
  error,
  phase,
}: Props) {
  const card = analysis?.outcomes.find((o) => o.id === selected) || null;
  const runLabel =
    selected === "custom"
      ? "Make it happen"
      : card
        ? `Make it · ${card.credits} credits`
        : "Make it";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--bg)]">
      <header className="flex items-center justify-between border-b border-[var(--border)] bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="brand-mark text-xl">
            Photopol
          </button>
          <span className="hidden text-sm text-[var(--muted)] sm:inline">Edit Image</span>
        </div>
        <div className="flex items-center gap-2">
          <p className="hidden text-[11px] text-[var(--muted)] sm:block">
            Session · <span className="font-semibold text-[var(--text)]">{sessionCredits}</span> credits
          </p>
          {topRight}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 md:flex-row md:items-start">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
            {phase === "result" && afterUrl ? (
              <div className="grid grid-cols-2 gap-0">
                <div>
                  <div className="px-3 py-2 text-xs text-[var(--muted)]">Before</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl || ""} alt="Before" className="aspect-square w-full object-contain" />
                </div>
                <div>
                  <div className="px-3 py-2 text-xs font-medium text-[var(--accent)]">After</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={afterUrl} alt="After" className="aspect-square w-full object-contain" />
                </div>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl || ""}
                alt="Your photo"
                className="mx-auto max-h-[420px] w-full object-contain"
              />
            )}
          </div>
          {analyzing && (
            <p className="text-sm text-[var(--muted)]">Photopol is understanding your image…</p>
          )}
          {analysis && !analyzing && phase === "choose" && (
            <p className="text-sm text-[var(--muted)]">{analysis.insight}</p>
          )}
          {phase === "result" && lastImproved && lastImproved.length > 0 && (
            <p className="text-sm text-[var(--muted)]">
              What we improved: {lastImproved.join(" · ")}
            </p>
          )}
        </div>

        <div className="w-full shrink-0 space-y-4 md:w-[380px]">
          {error}
          {phase === "choose" ? (
            <>
              <div>
                <h1 className="text-xl font-bold tracking-tight">What result do you want?</h1>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Pick a finish — Photopol handles the hard part.
                </p>
              </div>
              <div className="space-y-2.5">
                {(analysis?.outcomes || []).map((o) => (
                  <OutcomeButton
                    key={o.id}
                    card={o}
                    active={selected === o.id}
                    disabled={busy || analyzing}
                    onClick={() => onSelect(o.id as OutcomeId)}
                  />
                ))}
              </div>
              {selected === "custom" && (
                <textarea
                  value={customText}
                  onChange={(e) => onCustomText(e.target.value)}
                  rows={3}
                  placeholder='e.g. “Make this ready for my online store”'
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              )}
              <button
                type="button"
                className="btn btn-primary min-h-12 w-full"
                disabled={busy || analyzing || !selected || (selected === "custom" && !customText.trim())}
                onClick={onRun}
              >
                {busy ? status || "Working…" : runLabel}
              </button>
              {!isGuest && creditsBalance != null && (
                <p className="text-center text-xs text-[var(--muted)]">
                  Balance · {creditsBalance} credits
                </p>
              )}
              {isGuest && (
                <p className="text-center text-xs text-[var(--muted)]">Guests can try free</p>
              )}
              <div className="flex flex-wrap justify-center gap-4 pt-1 text-sm">
                <button type="button" className="text-[var(--muted)] hover:text-[var(--text)]" onClick={onAdvanced}>
                  Fine-tune manually
                </button>
                <button type="button" className="text-[var(--muted)] hover:text-[var(--text)]" onClick={onNewUpload}>
                  New photo
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold tracking-tight">Done</h1>
              <p className="text-sm text-[var(--muted)]">
                Export when you like it — or ask for another result on the same image.
              </p>
              <button type="button" className="btn btn-primary min-h-12 w-full" onClick={onDone}>
                Export
              </button>
              <button
                type="button"
                className="btn btn-ghost min-h-11 w-full"
                onClick={onChooseAgain}
                disabled={busy}
              >
                Choose another result
              </button>
              <div className="flex flex-wrap justify-center gap-4 pt-1 text-sm">
                <button type="button" className="text-[var(--muted)] hover:text-[var(--text)]" onClick={onAdvanced}>
                  Fine-tune
                </button>
                <button type="button" className="text-[var(--muted)] hover:text-[var(--text)]" onClick={onNewUpload}>
                  New photo
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
