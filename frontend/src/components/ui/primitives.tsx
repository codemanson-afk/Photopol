"use client";

export function CreditChip({
  balance,
  className = "",
}: {
  balance: number;
  className?: string;
}) {
  return (
    <span className={`chip chip-accent ${className}`}>
      <span className="font-semibold text-[var(--accent-strong)]">{balance}</span>
      <span>Credits</span>
    </span>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card mx-auto max-w-md px-6 py-12 text-center fade-in">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {body && <p className="mt-2 text-sm text-[var(--muted)]">{body}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 fade-in">
      <p className="text-sm text-[var(--danger)]">{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-ghost mt-3 min-h-10 px-3 text-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function ProcessingOverlay({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/70 backdrop-blur-[1px] fade-in">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-black/10 border-t-[var(--accent)]" />
      <p className="mt-4 text-sm font-medium text-[var(--accent-strong)]">{label}</p>
    </div>
  );
}
