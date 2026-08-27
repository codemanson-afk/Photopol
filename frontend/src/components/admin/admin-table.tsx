"use client";

import type { ReactNode } from "react";

export type AdminColumn<T> = {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => ReactNode;
};

export function AdminDataTable<T>({
  columns,
  rows,
  loading,
  empty = "No rows",
  rowKey,
}: {
  columns: AdminColumn<T>[];
  rows: T[];
  loading?: boolean;
  empty?: string;
  rowKey: (row: T) => string;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-white p-8 text-center text-sm text-[var(--muted)]">
        Loading…
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-white p-8 text-center text-sm text-[var(--muted)]">
        {empty}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-[var(--border)] bg-[#fafafa] text-xs uppercase tracking-wide text-[var(--muted)]">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`px-4 py-3 font-medium ${c.className || ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-[var(--border)] last:border-0 hover:bg-[#fafafa]/60">
              {columns.map((c) => (
                <td key={c.key} className={`px-4 py-3 align-middle ${c.className || ""}`}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminPager({
  total,
  limit,
  offset,
  onChange,
}: {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
}) {
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total <= limit) {
    return (
      <p className="mt-3 text-xs text-[var(--muted)]">
        {total} result{total === 1 ? "" : "s"}
      </p>
    );
  }
  return (
    <div className="mt-3 flex items-center justify-between gap-3 text-sm">
      <p className="text-xs text-[var(--muted)]">
        {total} results · page {page}/{pages}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-ghost min-h-9 px-3 text-sm"
          disabled={offset <= 0}
          onClick={() => onChange(Math.max(0, offset - limit))}
        >
          Prev
        </button>
        <button
          type="button"
          className="btn btn-ghost min-h-9 px-3 text-sm"
          disabled={offset + limit >= total}
          onClick={() => onChange(offset + limit)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
