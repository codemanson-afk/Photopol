"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { api, apiBlob } from "@/lib/api";
import { LIVE_TOOLS, type ToolId } from "@/lib/tools";

type Project = { id: string; name: string; images?: { id: string; original_filename: string; url?: string }[] };

type BatchInfo = {
  id: string;
  status: string;
  total: number;
  completed: number;
  failed: number;
  jobs: { id: string; image_id: string; status: string; progress: number }[];
};

export default function BatchPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [images, setImages] = useState<{ id: string; original_filename: string; url?: string }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [tool, setTool] = useState<ToolId>("enhance");
  const [batch, setBatch] = useState<BatchInfo | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Project[]>("/projects")
      .then((p) => {
        setProjects(p);
        if (p[0]) setProjectId(p[0].id);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    api<Project>(`/projects/${projectId}`)
      .then((p) => setImages(p.images || []))
      .catch((e) => setError(e.message));
  }, [projectId]);

  useEffect(() => {
    if (!batch || batch.status === "COMPLETED" || batch.status === "PARTIAL" || batch.status === "FAILED") return;
    const t = window.setInterval(() => {
      api<BatchInfo>(`/batches/${batch.id}`)
        .then(setBatch)
        .catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(t);
  }, [batch]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function onRun(e: FormEvent) {
    e.preventDefault();
    if (!projectId || !selected.length) return;
    setBusy(true);
    setError("");
    try {
      const res = await api<BatchInfo>("/batches", {
        method: "POST",
        body: JSON.stringify({
          project_id: projectId,
          image_ids: selected,
          tool,
        }),
      });
      setBatch(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch failed");
    } finally {
      setBusy(false);
    }
  }

  async function downloadZip() {
    if (!batch) return;
    const blob = await apiBlob(`/batches/${batch.id}/zip`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `photopol-batch-${batch.id.slice(0, 8)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell title="Batch">
      <div className="fade-in mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Batch studio</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Run one tool across multiple images. Plan limits: Free 1 · Pro 5 · Business 20.
          </p>
        </div>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        {!user && (
          <p className="text-sm text-[var(--muted)]">
            <Link href="/login" className="text-[var(--accent)]">
              Sign in
            </Link>{" "}
            to batch process.
          </p>
        )}
        <form onSubmit={onRun} className="card space-y-4 p-5">
          <label className="block text-xs font-medium text-[var(--muted)]">Project</label>
          <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <label className="block text-xs font-medium text-[var(--muted)]">Tool</label>
          <select className="input" value={tool} onChange={(e) => setTool(e.target.value as ToolId)}>
            {LIVE_TOOLS.filter((t) => t.id !== "object_remove" && t.id !== "crop").map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.map((im) => (
              <button
                key={im.id}
                type="button"
                onClick={() => toggle(im.id)}
                className={`overflow-hidden rounded-xl border text-left ${
                  selected.includes(im.id) ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/30" : "border-[var(--border)]"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {im.url ? <img src={im.url} alt="" className="aspect-square w-full object-cover" /> : null}
                <span className="block truncate px-2 py-1 text-[10px] text-[var(--muted)]">{im.original_filename}</span>
              </button>
            ))}
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy || !selected.length}>
            {busy ? "Starting…" : `Run on ${selected.length || 0} image(s)`}
          </button>
        </form>

        {batch && (
          <div className="card space-y-3 p-5">
            <div className="flex items-center justify-between">
              <p className="font-medium">
                {batch.status} · {batch.completed}/{batch.total}
              </p>
              {(batch.status === "COMPLETED" || batch.status === "PARTIAL") && (
                <button type="button" className="btn btn-ghost text-sm" onClick={() => void downloadZip()}>
                  Download ZIP
                </button>
              )}
            </div>
            <ul className="space-y-1 text-sm text-[var(--muted)]">
              {batch.jobs.map((j) => (
                <li key={j.id}>
                  {j.image_id.slice(0, 8)}… — {j.status} ({j.progress}%)
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AppShell>
  );
}
