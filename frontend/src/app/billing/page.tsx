"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";

type BillingStatus = {
  plan_id: string;
  status: string;
  credit_balance: number;
  reserved_credits: number;
  available_credits: number;
  current_period_end?: string | null;
  providers: { stripe: boolean; paddle: boolean };
  billing_provider?: string | null;
};

type Provider = "stripe" | "paddle";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    blurb: "Cutout, crop, resize, 2× upscale",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19/mo",
    blurb: "500 credits / mo · erase Best · 4× · replace",
  },
  {
    id: "business",
    name: "Business",
    price: "$49/mo",
    blurb: "2000 credits / mo · highest priority · batch",
  },
] as const;

export default function BillingPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [provider, setProvider] = useState<Provider | "">("");

  useEffect(() => {
    void api<BillingStatus>("/billing/status")
      .then((s) => {
        setStatus(s);
        const both = s.providers.stripe && s.providers.paddle;
        if (both) {
          setProvider((prev) => prev || "stripe");
        } else if (s.providers.stripe) {
          setProvider("stripe");
        } else if (s.providers.paddle) {
          setProvider("paddle");
        } else {
          setProvider("");
        }
      })
      .catch(() => setStatus(null));
  }, []);

  const anyProvider = useMemo(
    () => !!(status?.providers.stripe || status?.providers.paddle),
    [status]
  );
  const bothProviders = !!(status?.providers.stripe && status?.providers.paddle);

  async function checkoutPack() {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      if (!provider) {
        setError("Billing is not configured");
        setInfo("Enable Stripe and/or Paddle in backend env.");
        return;
      }
      const res = await api<{ checkout_url: string }>("/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ quantity: 1, mode: "payment", provider }),
      });
      window.location.href = res.checkout_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout unavailable");
      setInfo(
        provider === "paddle"
          ? "Needs PADDLE_API_KEY and PADDLE_PRICE_ID_CREDITS."
          : "Needs STRIPE_SECRET_KEY and STRIPE_PRICE_ID_CREDITS."
      );
    } finally {
      setBusy(false);
    }
  }

  async function checkoutPlan(plan: "pro" | "business") {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      if (!provider) {
        setError("Billing is not configured");
        return;
      }
      const res = await api<{ checkout_url: string }>("/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ mode: "subscription", plan, provider }),
      });
      window.location.href = res.checkout_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout unavailable");
      setInfo(
        provider === "paddle"
          ? `Needs PADDLE_PRICE_ID_${plan.toUpperCase()}_MONTHLY.`
          : `Needs STRIPE_PRICE_ID_${plan.toUpperCase()}_MONTHLY.`
      );
    } finally {
      setBusy(false);
    }
  }

  async function openPortal() {
    setBusy(true);
    setError("");
    try {
      const res = await api<{ portal_url: string }>("/billing/portal", { method: "POST" });
      window.location.href = res.portal_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Portal unavailable");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Billing">
      <div className="fade-in mx-auto max-w-3xl space-y-8">
        {status && (
          <div className="rounded-2xl border border-[var(--border)] bg-white p-5 text-sm">
            <p>
              Plan: <strong className="capitalize">{status.plan_id}</strong>
              {status.status !== "inactive" ? ` · ${status.status}` : ""}
              {status.billing_provider ? ` · via ${status.billing_provider}` : ""}
            </p>
            <p className="mt-1 text-[var(--muted)]">
              {status.available_credits} available ({status.credit_balance} balance
              {status.reserved_credits ? ` · ${status.reserved_credits} held` : ""})
            </p>
            {status.plan_id !== "free" && (
              <button
                type="button"
                className="btn btn-ghost mt-3 min-h-9 px-3 text-sm"
                disabled={busy}
                onClick={() => void openPortal()}
              >
                Manage subscription
              </button>
            )}
          </div>
        )}

        {!anyProvider && status && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Billing not configured. Set <code>STRIPE_ENABLED</code> / <code>PADDLE_ENABLED</code>{" "}
            with API keys.
          </p>
        )}

        {bothProviders && (
          <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <p className="text-sm font-semibold">Payment provider</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Choose how you want to pay.</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="provider"
                  checked={provider === "stripe"}
                  onChange={() => setProvider("stripe")}
                />
                Stripe
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="provider"
                  checked={provider === "paddle"}
                  onChange={() => setProvider("paddle")}
                />
                Paddle
              </label>
            </div>
          </div>
        )}

        {anyProvider && !bothProviders && provider && (
          <p className="text-xs text-[var(--muted)]">
            Checkout via <span className="capitalize">{provider}</span>
          </p>
        )}

        <div>
          <h2 className="text-lg font-semibold">Plans</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {PLANS.map((p) => (
              <div key={p.id} className="card flex flex-col p-5">
                <h3 className="font-semibold">{p.name}</h3>
                <p className="mt-1 text-2xl font-bold">{p.price}</p>
                <p className="mt-2 flex-1 text-sm text-[var(--muted)]">{p.blurb}</p>
                {p.id === "free" ? (
                  <p className="mt-4 text-xs text-[var(--muted)]">Current default</p>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary mt-4 min-h-10"
                    disabled={busy || !anyProvider}
                    onClick={() => void checkoutPlan(p.id)}
                  >
                    Subscribe
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="card max-w-md p-6">
          <h2 className="text-lg font-semibold">Credit pack</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">100 credits · one-time</p>
          <button
            type="button"
            className="btn btn-primary mt-5 min-h-11"
            disabled={busy || !anyProvider}
            onClick={() => void checkoutPack()}
          >
            {busy ? "Redirecting…" : "Buy credits"}
          </button>
          {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}
          {info && <p className="mt-2 text-xs text-[var(--muted)]">{info}</p>}
        </div>

        <Link href="/credits" className="text-sm text-[var(--accent)]">
          Credit history →
        </Link>
      </div>
    </AppShell>
  );
}
