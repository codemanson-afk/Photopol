"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { UploadImageButton } from "@/components/upload-image-button";

const steps = [
  {
    n: "1",
    title: "Upload",
    body: "Drop your image",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 16V4M7 9l5-5 5 5M5 20h14"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    n: "2",
    title: "Tell Photopol",
    body: "Pick a result — or describe it",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15z" fill="currentColor" />
      </svg>
    ),
  },
  {
    n: "3",
    title: "Done",
    body: "Export once — no re-upload",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 4v11M7 11l5 5 5-5M5 20h14"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

function ToolDemoRemoveBg() {
  return (
    <div className="relative aspect-[5/4] overflow-hidden bg-[#1a1a1e]">
      <div className="absolute inset-0 grid grid-cols-2">
        <div className="relative overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero/tool-face.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-[#4a5568]">
            Before
          </span>
        </div>
        <div className="relative overflow-hidden">
          <div className="ba-check absolute inset-0" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero/tool-cutout.png"
            alt=""
            className="absolute inset-0 h-full w-full object-contain object-center p-2"
          />
          <span className="absolute right-2 top-2 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-medium text-white">
            After
          </span>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white/80" />
    </div>
  );
}

function ToolDemoCrop() {
  return (
    <div className="relative aspect-[5/4] overflow-hidden bg-[#12121a]">
      <div className="absolute inset-0 flex items-center justify-center gap-2 p-3 sm:gap-3 sm:p-4">
        <div className="relative h-[78%] flex-1 overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero/before.jpg" alt="" className="h-full w-full object-cover opacity-90" />
          <div className="absolute inset-[14%] border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
            <div className="absolute -left-1 -top-1 h-2.5 w-2.5 border-l-2 border-t-2 border-white" />
            <div className="absolute -right-1 -top-1 h-2.5 w-2.5 border-r-2 border-t-2 border-white" />
            <div className="absolute -bottom-1 -left-1 h-2.5 w-2.5 border-b-2 border-l-2 border-white" />
            <div className="absolute -bottom-1 -right-1 h-2.5 w-2.5 border-b-2 border-r-2 border-white" />
          </div>
          <span className="absolute left-2 top-2 text-[10px] font-medium text-white/90">Before</span>
        </div>
        <div className="relative h-[78%] w-[38%] overflow-hidden rounded-lg ring-1 ring-white/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero/tool-face.jpg"
            alt=""
            className="h-full w-full object-cover"
          />
          <span className="absolute left-2 top-2 text-[10px] font-medium text-white/90">After</span>
        </div>
      </div>
    </div>
  );
}

function ToolDemoResize() {
  return (
    <div className="relative aspect-[5/4] overflow-hidden bg-gradient-to-br from-[#6d28d9] to-[#4c1d95]">
      <div className="absolute inset-0 flex items-center justify-center gap-3 p-4">
        <div className="relative h-[70%] w-[42%] overflow-hidden rounded-lg shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero/tool-face.jpg" alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-[12%] border-2 border-yellow-300/90">
            <div className="absolute -left-0.5 -top-0.5 h-2 w-2 bg-yellow-300" />
            <div className="absolute -right-0.5 -top-0.5 h-2 w-2 bg-yellow-300" />
            <div className="absolute -bottom-0.5 -left-0.5 h-2 w-2 bg-yellow-300" />
            <div className="absolute -bottom-0.5 -right-0.5 h-2 w-2 bg-yellow-300" />
          </div>
        </div>
        <div className="relative w-[40%] overflow-hidden rounded-xl bg-white shadow-xl">
          <div className="flex items-center gap-1.5 border-b border-black/5 px-2 py-1.5">
            <span className="h-4 w-4 rounded-full bg-[var(--accent)]" />
            <span className="truncate text-[9px] font-medium text-[#111118]">photopol</span>
          </div>
          <div className="aspect-square overflow-hidden bg-[#f3f3f6]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero/tool-square.jpg" alt="" className="h-full w-full object-cover" />
          </div>
          <div className="flex gap-2 px-2 py-1.5 text-[#111118]">
            <span className="text-[10px]">♥</span>
            <span className="text-[10px]">💬</span>
            <span className="ml-auto text-[10px]">1:1</span>
          </div>
        </div>
      </div>
      <span className="absolute bottom-2 right-2 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
        Social ready
      </span>
    </div>
  );
}

const tools = [
  {
    id: "store",
    label: "Online store ready",
    body: "Clean backdrop, polish, soft shadow — shop listings without the busywork.",
    href: "/workspace?outcome=store_ready",
    demo: <ToolDemoRemoveBg />,
  },
  {
    id: "pro",
    label: "Look professional",
    body: "AI decides what to fix so the photo feels finished.",
    href: "/workspace?outcome=professional",
    demo: <ToolDemoResize />,
  },
  {
    id: "ig",
    label: "Instagram advertisement",
    body: "Composition and size tuned for Instagram ads & feed.",
    href: "/workspace?outcome=ig_ad",
    demo: <ToolDemoCrop />,
  },
  {
    id: "edit",
    label: "Edit Image",
    body: "Upload once. Tell Photopol the result. AI does the hard part.",
    href: "/workspace",
    demo: <ToolDemoRemoveBg />,
  },
  {
    id: "create",
    label: "Create with AI",
    body: "Describe what you want — coming next.",
    href: "/create",
    demo: <ToolDemoResize />,
  },
  {
    id: "video",
    label: "Create Video",
    body: "Story videos with platform presets — coming after images.",
    href: "/create-video",
    demo: <ToolDemoCrop />,
  },
];

function HeroBeforeAfter() {
  return (
    <div className="relative rounded-[1.5rem] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="relative overflow-hidden rounded-2xl bg-[#ececf2]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero/before.jpg"
            alt="Before"
            className="aspect-[4/5] w-full object-cover"
            style={{ objectPosition: "50% 12%" }}
          />
          <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-[var(--muted)] shadow-sm">
            Before
          </span>
        </div>
        <div className="relative overflow-hidden rounded-2xl">
          <div className="ba-check absolute inset-0" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero/after.png"
            alt="After"
            className="relative aspect-[4/5] w-full object-cover"
            style={{ objectPosition: "50% 12%" }}
          />
          <span className="absolute bottom-3 left-3 rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-medium text-white shadow-sm">
            After
          </span>
        </div>
      </div>
      <div className="pointer-events-none absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-[var(--shadow-soft)]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 12h14M13 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/home");
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <SiteHeader />

      {/* Hero — #F7F7F9 */}
      <section className="bg-[var(--bg)]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-10 md:grid-cols-2 md:gap-12 md:px-6 md:pb-20 md:pt-14">
          <div className="slide-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3.5 py-1.5 text-sm font-medium text-[var(--text)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              AI Powered Image Editing
            </div>
            <h1 className="mt-6 text-[2.5rem] font-bold leading-[1.08] tracking-[-0.035em] text-[var(--text)] md:text-[3.35rem]">
              Edit Images with <span className="text-[var(--accent)]">AI.</span>
              <br />
              Fast &amp; Easy.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-[#4a5568] md:text-lg">
              Tell Photopol the result you want. AI does the hard part — not another Photoshop.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <UploadImageButton className="btn btn-primary min-h-12 rounded-xl px-7">
                Edit Image
              </UploadImageButton>
              <a href="#tools" className="btn btn-ghost min-h-12 rounded-xl px-6">
                See results
              </a>
            </div>
            <p className="mt-4 text-xs font-medium text-[#4a5568]">
              JPG, PNG or WEBP · Start creating in seconds
            </p>
          </div>

          <div className="reveal mx-auto w-full max-w-[460px] md:max-w-none">
            <HeroBeforeAfter />
          </div>
        </div>
      </section>

      {/* Steps — #FFFFFF, no heavy border */}
      <section id="workflow" className="bg-white py-16 md:py-20">
        <div className="mx-auto grid max-w-5xl gap-10 px-4 md:grid-cols-3 md:gap-8 md:px-6">
          {steps.map((s) => (
            <div key={s.n} className="text-center md:text-left">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] md:mx-0">
                {s.icon}
              </div>
              <div className="mt-4 text-xs font-semibold tracking-[0.18em] text-[var(--accent)]">0{s.n}</div>
              <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">{s.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[#4a5568]">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tools — #F7F7F9 */}
      <section id="tools" className="bg-[var(--bg)] py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[var(--text)] md:text-4xl">
              Results, not tools.
            </h2>
            <p className="mt-3 text-base text-[#4a5568]">
              One AI workspace. You choose the finish — Photopol runs the complicated edits.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((t) => (
              <Link
                key={t.id}
                href={t.href}
                className="group overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-white shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
              >
                {t.demo}
                <div className="p-5">
                  <h3 className="text-lg font-semibold text-[var(--text)]">{t.label}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#4a5568]">{t.body}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--accent)]">
                    Try it
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="transition group-hover:translate-x-0.5"
                      aria-hidden
                    >
                      <path
                        d="M5 12h14M13 6l6 6-6 6"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
