"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { BeforeAfter } from "@/components/workspace/before-after";
import {
  INTENT_CHIPS,
  OUTCOMES,
  VARIATIONS,
  type IntentChipId,
  type OutcomeId,
  type VariationId,
} from "@/lib/outcomes";
import type { OutcomeAnalysis } from "@/lib/tools";

export type VariantResult = {
  versionId: string;
  url: string;
};

type Props = {
  previewUrl: string | null;
  afterUrl?: string | null;
  analysis: OutcomeAnalysis | null;
  analyzing: boolean;
  selected: OutcomeId | null;
  customText: string;
  onCustomText: (v: string) => void;
  busy: boolean;
  status?: string;
  creditsBalance: number | null;
  creditsUsedMonth?: number | null;
  creditsAllowance?: number | null;
  lastJobCredits?: number | null;
  isGuest?: boolean;
  lastImproved?: string[];
  outcomeLabel?: string | null;
  phase: "choose" | "result";
  activeChip: IntentChipId | null;
  onChip: (id: IntentChipId) => void;
  showMoreChips: boolean;
  variants: Partial<Record<VariationId, VariantResult>>;
  generatingVariant: VariationId | null;
  onRunVariant: (id: VariationId) => void;
  onSubmitIntent: () => void;
  onDownload: () => void;
  onMakeAnother: () => void;
  onAskAi: () => void;
  onAdvanced: () => void;
  onNewUpload: () => void;
  onViewOriginal?: () => void;
  userName?: string | null;
  error?: ReactNode;
};

const NAV = [
  {
    href: "/workspace",
    label: "Edit Image",
    live: true,
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="3.5" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M8 15l.8-2.5L14.5 7a1.4 1.4 0 012 2L10.5 15l-2.5.8L8 15z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/create-video",
    label: "Create Video",
    live: false,
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="5" width="14" height="14" rx="3.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M10 9.5v7l5.5-3.5L10 9.5z" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/create",
    label: "Create with AI",
    live: false,
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 2.5l1.4 4.6L18 8.5l-4.6 1.4L12 14.5l-1.4-4.6L6 8.5l4.6-1.4L12 2.5z"
          fill="currentColor"
        />
        <path d="M18.5 13l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3z" fill="currentColor" />
        <path d="M5.5 14l.55 1.8 1.8.55-1.8.55-.55 1.8-.55-1.8-1.8-.55 1.8-.55.55-1.8z" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/captions",
    label: "AI Captions",
    live: false,
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
] as const;

const CHIP_ICONS: Record<IntentChipId, ReactNode> = {
  store_ready: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 9h16l-1.5 11H5.5L4 9zM8 9V7a4 4 0 018 0v2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  ),
  professional: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  ),
  ig_ad: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10v4l12 6V4L4 10zM16 8l4-2v12l-4-2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  ),
  ig_post: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  ),
  more: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  ),
};

const DEFAULT_IMPROVES =
  OUTCOMES.find((o) => o.id === "store_ready")?.improves || [
    "Enhanced lighting and color",
    "Sharpened product details",
    "Removed distracting background",
  ];

export function IntelligenceWorkspace({
  previewUrl,
  afterUrl,
  analysis,
  analyzing,
  selected,
  customText,
  onCustomText,
  busy,
  status,
  creditsBalance,
  creditsUsedMonth,
  creditsAllowance,
  lastJobCredits,
  isGuest,
  lastImproved,
  outcomeLabel: _outcomeLabel,
  phase,
  activeChip,
  onChip,
  showMoreChips,
  variants,
  generatingVariant,
  onRunVariant,
  onSubmitIntent,
  onDownload,
  onMakeAnother,
  onAskAi,
  onAdvanced,
  onNewUpload,
  onViewOriginal,
  userName,
  error,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const used = creditsUsedMonth ?? 0;
  const allow = creditsAllowance ?? 0;
  const bal = creditsBalance ?? 0;
  const ready = phase === "result";
  const showResult = ready && !!afterUrl;
  const showSidePanel = !!previewUrl;
  const hasRealImproves = !!(lastImproved && lastImproved.length > 0);
  const showPendingImproves = !hasRealImproves && (busy || analyzing);
  const improves = hasRealImproves ? lastImproved! : DEFAULT_IMPROVES;

  const hasMonthly = allow > 0;
  const creditsUsedDisplay = hasMonthly
    ? Math.min(Math.max(used > 0 ? used : Math.max(0, allow - bal), 0), allow)
    : used;

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#f4f4f7] text-[var(--text)]">
      {/* Sidebar — mockup scale */}
      <aside className="hidden h-full w-[300px] shrink-0 flex-col border-r border-[var(--border)] bg-white lg:flex">
        <div className="flex shrink-0 items-center gap-3 px-5 py-7">
          <span className="text-[var(--accent)]" aria-hidden>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z"
                fill="currentColor"
              />
            </svg>
          </span>
          <Link href="/home" className="brand-mark text-[28px] leading-none tracking-tight text-[var(--text)]">
            photopol
          </Link>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3.5 pt-1">
          {NAV.map((n) => {
            const active = n.href === "/workspace";
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`relative flex items-center gap-4 rounded-2xl px-4 py-4 text-[16px] font-semibold transition ${
                  active
                    ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                    : "text-[#22222c] hover:bg-[#f7f7f9]"
                }`}
              >
                {active && (
                  <span className="absolute bottom-2.5 left-0 top-2.5 w-[5px] rounded-r-full bg-[var(--accent)]" />
                )}
                <span className={active ? "text-[var(--accent)]" : "text-[#2f2f3a]"}>{n.icon}</span>
                <span className="flex-1">{n.label}</span>
                {!n.live && (
                  <span className="rounded-full bg-[#eef0f5] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Soon
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mx-3.5 mb-4 shrink-0 space-y-3">
          <div className="rounded-[20px] bg-[var(--accent-soft)] p-5">
            <div className="mb-3 text-[var(--accent)]">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 2.5l1.4 4.6L18 8.5l-4.6 1.4L12 14.5l-1.4-4.6L6 8.5l4.6-1.4L12 2.5z"
                  fill="currentColor"
                />
                <path
                  d="M18.2 13.2l.65 2.15 2.15.65-2.15.65-.65 2.15-.65-2.15-2.15-.65 2.15-.65.65-2.15z"
                  fill="currentColor"
                />
                <path
                  d="M5.8 14l.5 1.65 1.65.5-1.65.5-.5 1.65-.5-1.65-1.65-.5 1.65-.5.5-1.65z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <div className="text-[16px] font-bold text-[var(--text)]">Photopol Intelligence</div>
            <p className="mt-2 text-[14px] leading-relaxed text-[#3d3d4a]">
              Your AI creative partner. Tell us what you want, we&apos;ll handle the rest.
            </p>
          </div>

          <div className="rounded-[20px] border border-[var(--border)] bg-white px-4 py-4">
            {!isGuest ? (
              hasMonthly ? (
                <>
                  <div className="flex items-center justify-between text-[14px]">
                    <span className="font-medium text-[var(--muted)]">Credits used</span>
                    <span className="font-semibold tabular-nums text-[var(--text)]">
                      {creditsUsedDisplay} / {allow}
                    </span>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#eef0f5]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)]"
                      style={{
                        width: `${Math.min(100, Math.round((creditsUsedDisplay / allow) * 100))}%`,
                      }}
                    />
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-[13px] text-[var(--muted)]">
                    <span>
                      Balance · <span className="font-semibold tabular-nums text-[var(--text)]">{bal}</span>
                    </span>
                    <Link href="/billing" className="inline-flex items-center gap-1 font-semibold text-[var(--accent)]">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M5 16l3-8 4 4 4-6 3 10H5z"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Upgrade
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between text-[14px]">
                    <span className="font-medium text-[var(--muted)]">This session</span>
                    <span className="font-semibold tabular-nums text-[var(--text)]">
                      {creditsUsedDisplay} used
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-[13px] text-[var(--muted)]">
                    <span>
                      Balance · <span className="font-semibold tabular-nums text-[var(--text)]">{bal}</span>
                    </span>
                    <Link href="/billing" className="inline-flex items-center gap-1 font-semibold text-[var(--accent)]">
                      Upgrade
                    </Link>
                  </div>
                </>
              )
            ) : (
              <p className="text-[14px] text-[var(--muted)]">
                Guest try ·{" "}
                <Link href="/register" className="font-semibold text-[var(--accent)]">
                  Sign up
                </Link>
              </p>
            )}
          </div>
        </div>
      </aside>

      {/* Main column — locked to viewport */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-white px-4 py-2.5 md:px-5">
          <div className="flex items-center gap-2.5 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-white">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <Link href="/home" className="brand-mark text-lg">
              Photopol
            </Link>
          </div>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2.5 sm:gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[#fafafa] px-3.5 py-1.5 text-[13px] font-semibold">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden className="text-[var(--accent)]">
                <path
                  d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"
                  fill="currentColor"
                />
              </svg>
              Credits {isGuest ? "—" : bal}
            </span>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted)] hover:bg-[#fafafa]"
              aria-label="Notifications"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M6 9a6 6 0 0112 0c0 7 3 7 3 7H3s3 0 3-7M10 19a2 2 0 004 0"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] text-sm font-bold text-white"
              title={userName || "You"}
            >
              {(userName || "U").slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 md:p-4">
          {/* Stage fills remaining height */}
          <div className="flex min-h-0 flex-1 gap-3">
            <div className="min-h-0 min-w-0 flex-1">
              <BeforeAfter
                fill
                beforeUrl={previewUrl}
                afterUrl={showResult ? afterUrl : null}
                beforeLabel="Original"
                afterLabel="Result"
                processing={
                  busy ? status || "Photopol is editing…" : analyzing ? "Understanding…" : null
                }
                className="!rounded-2xl shadow-[var(--shadow-soft)]"
              />
            </div>

            {showSidePanel && (
              <aside className="hidden w-[340px] shrink-0 flex-col lg:flex">
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-soft)]">
                  <div className="flex shrink-0 items-start gap-3.5">
                    <span
                      className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[2.5px] ${
                        ready
                          ? "border-emerald-500 text-emerald-600"
                          : "border-[var(--accent)] text-[var(--accent)]"
                      }`}
                    >
                      {ready ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path
                            d="M5 12l5 5L20 7"
                            stroke="currentColor"
                            strokeWidth="2.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : busy || analyzing ? (
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path
                            d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"
                            fill="currentColor"
                          />
                        </svg>
                      )}
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-[22px] font-bold leading-tight tracking-tight text-[var(--text)]">
                        Your image is ready!
                      </h2>
                      <p className="mt-2 text-[15px] leading-snug text-[var(--muted)]">
                        We’ve automatically enhanced your product for a professional store-ready
                        look.
                      </p>
                    </div>
                  </div>

                  <div className="my-5 shrink-0 border-t border-[var(--border)]" />

                  <p className="shrink-0 text-[15px] font-bold text-[var(--text)]">
                    What Photopol improved
                  </p>
                  {showPendingImproves ? (
                    <ul className="mt-3.5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                      {DEFAULT_IMPROVES.map((item) => (
                        <li
                          key={item}
                          className="flex gap-3 text-[15px] leading-snug text-[var(--muted)] opacity-50"
                        >
                          <span className="mt-0.5 shrink-0">
                            <span className="block h-4 w-4 animate-pulse rounded-full bg-[#e8e8ee]" />
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="mt-3.5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                      {improves.map((item) => (
                        <li key={item} className="flex gap-3 text-[15px] leading-snug text-[var(--text)]">
                          <span
                            className={`mt-0.5 shrink-0 ${ready ? "text-emerald-600" : "text-[var(--accent)]"}`}
                            aria-hidden
                          >
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                              <path
                                d="M5 12l5 5L20 7"
                                stroke="currentColor"
                                strokeWidth="2.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-5 flex shrink-0 flex-wrap items-center gap-2.5">
                    {ready && onViewOriginal && (
                      <button
                        type="button"
                        onClick={onViewOriginal}
                        className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[#f4f4f7] px-4 py-2.5 text-[14px] font-semibold text-[var(--accent)] transition hover:bg-[#ececf2]"
                      >
                        View original
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path
                            d="M9 14H4v-5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M4 9c2.5-3.5 6-5 10-5a8 8 0 11-1.5 15.8"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    )}
                    {ready && (lastJobCredits ?? 0) > 0 && (
                      <span className="rounded-full border border-[var(--border)] bg-[#fafafa] px-3 py-2 text-[13px] font-medium text-[var(--muted)]">
                        {lastJobCredits} credit{(lastJobCredits ?? 0) === 1 ? "" : "s"} used
                      </span>
                    )}
                  </div>
                </div>
              </aside>
            )}
          </div>

          {/* Bottom dock — always in viewport */}
          <div className="flex shrink-0 flex-col gap-2.5">
            <div className="rounded-2xl border border-[var(--border)] bg-white px-3 py-2.5 shadow-[var(--shadow-card)] md:px-4">
              <div className="flex items-center gap-2">
                <span className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)] sm:flex">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"
                      fill="currentColor"
                    />
                  </svg>
                </span>
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text)]">
                  {ready
                    ? "Want a different result? Tell me or pick a look."
                    : analyzing
                      ? "Looking at your image…"
                      : analysis?.insight || "I understand your image. What would you like to achieve?"}
                </p>
              </div>

              <form
                className="mt-2 flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  onSubmitIntent();
                }}
              >
                <input
                  ref={inputRef}
                  value={customText}
                  onChange={(e) => onCustomText(e.target.value)}
                  placeholder="Tell Photopol what you want..."
                  className="min-h-11 flex-1 rounded-xl border border-[var(--border)] bg-[#fafafa] px-3.5 text-[15px] outline-none transition focus:border-[var(--accent)] focus:bg-white"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onSubmitIntent();
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={busy || analyzing}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-md transition hover:bg-[var(--accent-strong)] disabled:opacity-40"
                  aria-label="Run"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M5 12h14M13 6l6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </form>

              <div className="mt-2 flex gap-2 overflow-x-auto pb-0.5">
                {INTENT_CHIPS.map((c) => {
                  const active =
                    activeChip === c.id ||
                    (c.outcome != null &&
                      selected === c.outcome &&
                      activeChip !== "more" &&
                      c.id !== "more");
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={busy || analyzing}
                      onClick={() => onChip(c.id)}
                      className={`flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2.5 text-left transition disabled:opacity-50 ${
                        active
                          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                          : "border-[var(--border)] bg-white hover:border-[var(--accent)]/35"
                      }`}
                    >
                      <span className={active ? "text-[var(--accent)]" : "text-[var(--muted)]"}>
                        {CHIP_ICONS[c.id]}
                      </span>
                      <span className="whitespace-nowrap text-[13px] font-semibold">{c.label}</span>
                    </button>
                  );
                })}
              </div>

              {showMoreChips && (
                <button
                  type="button"
                  className="mt-1.5 text-[11px] font-medium text-[var(--muted)] hover:text-[var(--text)]"
                  onClick={onAdvanced}
                >
                  Fine-tune manually →
                </button>
              )}
              {error && <div className="mt-2">{error}</div>}
            </div>

            {ready && (
              <div className="flex items-end gap-3">
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="mb-1.5 text-xs font-semibold text-[var(--muted)]">
                    More results you might like
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-0.5">
                    {VARIATIONS.map((v) => {
                      const got = variants[v.id];
                      const spinning = generatingVariant === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          disabled={busy}
                          onClick={() => onRunVariant(v.id)}
                          className="w-[88px] shrink-0 overflow-hidden rounded-xl border border-[var(--border)] bg-white text-left shadow-sm transition hover:border-[var(--accent)]/40 disabled:opacity-60"
                        >
                          <div className="relative aspect-square bg-[#eef0f5]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={got?.url || previewUrl || ""}
                              alt=""
                              className={`h-full w-full object-cover ${got ? "" : "opacity-45"}`}
                            />
                            {spinning && (
                              <div className="absolute inset-0 flex items-center justify-center bg-white/75">
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-black/10 border-t-[var(--accent)]" />
                              </div>
                            )}
                          </div>
                          <div className="truncate px-1.5 py-1 text-center text-[10px] font-semibold">
                            {v.label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col gap-2 sm:w-[220px]">
                  <button
                    type="button"
                    onClick={onDownload}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 text-[15px] font-semibold text-white shadow-md transition hover:bg-[var(--accent-strong)]"
                  >
                    Download Image
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={onMakeAnother}
                      className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-[var(--accent)]/30 bg-white px-2 text-[12px] font-semibold text-[var(--accent-strong)]"
                    >
                      Another version
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onAskAi();
                        inputRef.current?.focus();
                      }}
                      className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-[var(--accent)]/30 bg-white px-2 text-[12px] font-semibold text-[var(--accent-strong)]"
                    >
                      Ask AI
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={onNewUpload}
                    className="text-center text-[12px] text-[var(--muted)] hover:text-[var(--text)]"
                  >
                    New photo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

