"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/components/auth-provider";

type Pending = "download" | "new_upload" | "job_limit" | "generic";

type Props = {
  open: boolean;
  reason: Pending;
  onClose: () => void;
  onSuccess: (projectId: string | null) => void;
};

export function AuthModal({ open, reason, onClose, onSuccess }: Props) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<"login" | "register">("register");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const headline =
    reason === "download"
      ? "Save your image"
      : reason === "job_limit"
        ? "Free edit used"
        : reason === "new_upload"
          ? "Sign in to edit more images"
          : "Continue with Photopol";

  const sub =
    reason === "download"
      ? "Create a free account or sign in to download your result."
      : reason === "job_limit"
        ? "You used your free process. Sign in to apply more edits and download."
        : reason === "new_upload"
          ? "Your first image was free. Sign in to keep going."
          : "Create a free account or sign in.";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const projectId =
        tab === "login"
          ? await login(email, password)
          : await register(fullName, email, password);
      onSuccess(projectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="card w-full max-w-md p-6 fade-in">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{headline}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{sub}</p>
          </div>
          <button type="button" className="text-[var(--muted)] hover:text-[var(--text)]" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mt-4 flex gap-2 rounded-xl bg-[#f5f6fa] p-1">
          <button
            type="button"
            className={`min-h-11 flex-1 rounded-lg px-3 text-sm font-medium ${
              tab === "register" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"
            }`}
            onClick={() => setTab("register")}
          >
            Register
          </button>
          <button
            type="button"
            className={`min-h-11 flex-1 rounded-lg px-3 text-sm font-medium ${
              tab === "login" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"
            }`}
            onClick={() => setTab("login")}
          >
            Sign in
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          {tab === "register" && (
            <input
              className="input min-h-11"
              placeholder="Full name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          )}
          <input
            className="input min-h-11"
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="input min-h-11"
            type="password"
            placeholder="Password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <button type="submit" className="btn btn-primary min-h-12 w-full" disabled={busy}>
            {busy ? "Please wait…" : tab === "login" ? "Sign in" : "Create free account"}
          </button>
        </form>
      </div>
    </div>
  );
}
