"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { CreditChip, ErrorBanner } from "@/components/ui/primitives";
import { AuthModal } from "@/components/workspace/auth-modal";
import { DownloadPanel } from "@/components/workspace/download-panel";
import {
  IntelligenceWorkspace,
  type VariantResult,
} from "@/components/workspace/intelligence-workspace";
import { StudioEditor } from "@/components/workspace/studio-editor";
import { UploadZone } from "@/components/workspace/upload-zone";
import { api, apiBlob, clearGuestSession, ensureGuestSession } from "@/lib/api";
import { autoProjectName, friendlyError } from "@/lib/errors";
import { takePendingUpload } from "@/lib/pending-upload";
import { parseCapabilityParam, toolsForCapability } from "@/lib/capabilities";
import {
  INTENT_CHIPS,
  OUTCOMES,
  VARIATIONS,
  inferOutcomeFromText,
  parseOutcomeParam,
  type IntentChipId,
  type OutcomeId,
  type VariationId,
} from "@/lib/outcomes";
import {
  analyzeOutcomes,
  centerCropBox,
  createExportPack,
  getTool,
  runOutcome,
  runProductPipeline,
  uploadMask,
  type OutcomeAnalysis,
  type ToolId,
} from "@/lib/tools";
import type { ImageItem, ImageVersion, Job, Project, ProjectDetail } from "@/lib/types";

function processingCopy(tool: ToolId, phase: "start" | "mid" | "end"): string {
  const mid: Record<ToolId, string> = {
    remove_bg: "Removing background…",
    resize: "Resizing…",
    crop: "Cropping…",
    object_remove: "Erasing…",
    upscale: "Upscaling…",
    enhance: "Enhancing…",
    bg_replace: "Replacing background…",
  };
  if (phase === "start") return "Preparing…";
  if (phase === "mid") return mid[tool] || "Working…";
  return "Finalizing…";
}

export default function WorkspacePage() {
  const { user, refresh } = useAuth();
  const search = useSearchParams();
  const router = useRouter();
  const projectParam = search.get("project");
  const toolParam = search.get("tool") as ToolId | null;
  const capabilityParam = parseCapabilityParam(search.get("capability"));
  const outcomeParam = parseOutcomeParam(search.get("outcome"));
  const forceAdvanced =
    search.get("advanced") === "1" || !!toolParam || !!capabilityParam;

  const initialTool = ((): ToolId => {
    if (toolParam && getTool(toolParam)) return toolParam;
    if (capabilityParam) {
      const first = toolsForCapability(capabilityParam)[0];
      if (first && getTool(first)) return first;
    }
    return "remove_bg";
  })();

  const [projectId, setProjectId] = useState<string | null>(projectParam);
  const [image, setImage] = useState<ImageItem | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploadReady, setUploadReady] = useState(false);
  const [selectedTool, setSelectedTool] = useState<ToolId>(initialTool);
  const [editorMode, setEditorMode] = useState<"intent" | "advanced">(
    forceAdvanced ? "advanced" : "intent"
  );
  const [intentPhase, setIntentPhase] = useState<"choose" | "result">("choose");
  const [outcomeAnalysis, setOutcomeAnalysis] = useState<OutcomeAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<OutcomeId | null>(
    outcomeParam || null
  );
  const [customIntent, setCustomIntent] = useState("");
  const [lastImproved, setLastImproved] = useState<string[]>([]);
  const [outcomeLabel, setOutcomeLabel] = useState<string | null>(null);
  const [activeChip, setActiveChip] = useState<IntentChipId | null>(
    outcomeParam === "store_ready"
      ? "store_ready"
      : outcomeParam === "professional"
        ? "professional"
        : outcomeParam === "ig_ad"
          ? "ig_ad"
          : null
  );
  const [showMoreChips, setShowMoreChips] = useState(false);
  const [variantMap, setVariantMap] = useState<Partial<Record<VariationId, VariantResult>>>({});
  const [generatingVariant, setGeneratingVariant] = useState<VariationId | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [aspect, setAspect] = useState("1:1");
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [cropAspect, setCropAspect] = useState("1:1");
  const [upscaleScale, setUpscaleScale] = useState<2 | 4>(2);
  const [bgColor, setBgColor] = useState("#8B5CF6");
  const [maskBlob, setMaskBlob] = useState<Blob | null>(null);
  const [exportFormat, setExportFormat] = useState("png");
  const [exportQuality, setExportQuality] = useState(92);
  const [stripMetadata, setStripMetadata] = useState(true);
  const [brushSize, setBrushSize] = useState(40);
  const [dropShadow, setDropShadow] = useState(true);
  const [subjectScale, setSubjectScale] = useState(100);
  const [position, setPosition] = useState("center");
  const [fit, setFit] = useState("cover");
  const [enhanceManual, setEnhanceManual] = useState(false);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [sharpen, setSharpen] = useState(25);
  const [warmth, setWarmth] = useState(0);
  const [rotate, setRotate] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [lastCreditsUsed, setLastCreditsUsed] = useState(0);
  const [sessionCredits, setSessionCredits] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState<"download" | "new_upload" | "job_limit" | "generic">(
    "generic"
  );
  const [pendingDownload, setPendingDownload] = useState(false);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [step, setStep] = useState<"upload" | "edit" | "download">("upload");
  const [showCompare, setShowCompare] = useState(true);

  const runAnalyze = useCallback(
    async (pid: string, img: ImageItem) => {
      if (forceAdvanced) return null;
      setAnalyzing(true);
      setError("");
      try {
        const orig = img.versions.find((v) => v.kind === "ORIGINAL");
        const a = await analyzeOutcomes({
          projectId: pid,
          imageId: img.id,
          versionId: orig?.id,
        });
        setOutcomeAnalysis(a);
        const rec = a.outcomes.find((o) => o.recommended);
        const pick =
          (outcomeParam as OutcomeId | null) ||
          (rec?.id as OutcomeId | undefined) ||
          "store_ready";
        setSelectedOutcome((prev) => prev || pick);
        setIntentPhase("choose");
        setEditorMode("intent");
        return { analysis: a, recommended: pick as OutcomeId };
      } catch (e) {
        setError(friendlyError(e));
        return null;
      } finally {
        setAnalyzing(false);
      }
    },
    [forceAdvanced, outcomeParam]
  );

  const original: ImageVersion | undefined = image?.versions.find((v) => v.kind === "ORIGINAL");
  const processed: ImageVersion | undefined = useMemo(() => {
    if (!image?.versions?.length) return undefined;
    if (activeVersionId) {
      const picked = image.versions.find((v) => v.id === activeVersionId);
      if (picked?.kind === "PROCESSED") return picked;
      if (picked?.kind === "ORIGINAL") return undefined;
    }
    return [...image.versions].reverse().find((v) => v.kind === "PROCESSED");
  }, [image, activeVersionId]);

  const beforeUrl = original?.url || localPreview;
  const afterUrl = processed?.url || null;

  const tool = getTool(selectedTool)!;
  const cost = user
    ? selectedTool === "upscale" && upscaleScale === 4
      ? 14
      : tool.credits
    : 0;

  const uploadingRef = useRef(false);

  const loadProject = useCallback(async (id: string, opts?: { analyze?: boolean }) => {
    const detail = await api<ProjectDetail>(`/projects/${id}`);
    if (uploadingRef.current) return null;
    setProjectId(detail.id);
    const imgs = detail.images || [];
    const img = imgs.length ? imgs[imgs.length - 1] : null;
    setImage(img);
    if (img) {
      setLocalPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setUploadReady(true);
      setStep("edit");
      const last = [...(img.versions || [])].reverse().find((v) => v.kind === "PROCESSED");
      setActiveVersionId(last?.id || img.versions.find((v) => v.kind === "ORIGINAL")?.id || null);
      if (opts?.analyze !== false && !forceAdvanced) {
        void runAnalyze(detail.id, img);
      }
    }
    return img;
  }, [forceAdvanced, runAnalyze]);

  useEffect(() => {
    if (!projectParam) return;
    if (uploadingRef.current) return;
    void ensureGuestSession()
      .then(() => loadProject(projectParam))
      .catch((e) => setError(friendlyError(e)));
  }, [projectParam, loadProject]);

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  async function handleUpload(file: File) {
    const name = (file.name || "").toLowerCase();
    const type = (file.type || "").toLowerCase();
    const okExt = /\.(jpe?g|png|webp)$/i.test(name);
    const okType =
      type === "image/jpeg" ||
      type === "image/jpg" ||
      type === "image/png" ||
      type === "image/webp" ||
      (type === "" && okExt) ||
      (type === "application/octet-stream" && okExt);
    if (!okType && !okExt) {
      setError("That file couldn’t be used. Try JPG, PNG, or WEBP under 10MB.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("That image is too large. Use a file under 10MB.");
      return;
    }

    uploadingRef.current = true;
    setError("");
    if (localPreview) URL.revokeObjectURL(localPreview);
    const blobUrl = URL.createObjectURL(file);
    setLocalPreview(blobUrl);
    setImage(null);
    setUploadReady(false);
    setBusy(true);
    setStatus("Uploading your image…");
    setStep("edit");
    setActiveVersionId(null);
    setSessionCredits(0);

    try {
      if (!user) await ensureGuestSession();

      // Stay on current project when possible — replace image in place
      let pid = projectId || projectParam;
      if (!pid) {
        const p = await api<Project>("/projects", {
          method: "POST",
          body: JSON.stringify({ name: autoProjectName() }),
        });
        pid = String(p.id);
        setProjectId(pid);
      }

      const fd = new FormData();
      fd.append("file", file, file.name || "upload.jpg");
      const img = await api<ImageItem>(`/projects/${pid}/upload`, {
        method: "POST",
        body: fd,
      });
      setProjectId(pid);
      setImage(img);
      setUploadReady(true);
      setStatus("");
      setActiveVersionId(img.versions.find((v) => v.kind === "ORIGINAL")?.id || null);
      setSessionCredits(0);
      setIntentPhase("choose");
      setSelectedOutcome(outcomeParam || "store_ready");
      setCustomIntent("");
      setLastImproved([]);
      setOutcomeLabel(null);
      setVariantMap({});
      if (forceAdvanced) {
        setEditorMode("advanced");
      } else {
        setEditorMode("intent");
        setActiveChip((outcomeParam as IntentChipId) || "store_ready");
        void (async () => {
          const analyzed = await runAnalyze(pid, img);
          const best =
            outcomeParam ||
            analyzed?.recommended ||
            "store_ready";
          setSelectedOutcome(best);
          setActiveChip(
            best === "professional" || best === "ig_ad" || best === "store_ready"
              ? best
              : "store_ready"
          );
          await runIntentOutcome({
            outcome: best,
            projectId: pid,
            image: img,
            versionId: img.versions.find((v) => v.kind === "ORIGINAL")?.id,
          });
        })();
      }
      if (projectParam !== pid) {
        router.replace(`/workspace?project=${pid}`);
      }
      setLocalPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    } catch (e) {
      const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
      const http = e && typeof e === "object" && "status" in e ? Number((e as { status: number }).status) : 0;
      setImage(null);
      setUploadReady(false);
      setActiveVersionId(null);
      if (code === "guest_limit_images") {
        setAuthReason("new_upload");
        setAuthOpen(true);
        setStatus("");
      } else if (!user && (code === "unauthorized" || http === 401 || code === "guest_session_failed")) {
        clearGuestSession();
        try {
          await ensureGuestSession(true);
          setError("Session refreshed — re-upload to continue.");
        } catch {
          setError(friendlyError(e));
        }
        setStatus("");
      } else {
        setError(friendlyError(e));
        setStatus("");
      }
    } finally {
      uploadingRef.current = false;
      setBusy(false);
    }
  }

  const handleUploadRef = useRef(handleUpload);
  handleUploadRef.current = handleUpload;

  useEffect(() => {
    const file = takePendingUpload();
    if (file) void handleUploadRef.current(file);
  }, []);

  async function runApply() {
    if (!uploadReady || !projectId || !image) {
      setStatus("Almost ready…");
      return;
    }
    setError("");
    setBusy(true);
    setStatus(processingCopy(selectedTool, "start"));
    const midTimer = window.setTimeout(() => setStatus(processingCopy(selectedTool, "mid")), 500);

    try {
      const sourceVer = processed || original;
      let sourceW = sourceVer?.width || image.width || 0;
      let sourceH = sourceVer?.height || image.height || 0;
      if ((!sourceW || !sourceH) && (sourceVer?.url || image.url || beforeUrl)) {
        const url = sourceVer?.url || image.url || beforeUrl!;
        const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
          const im = new window.Image();
          im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
          im.onerror = () => reject(new Error("Could not read image size"));
          im.src = url;
        });
        sourceW = dims.w;
        sourceH = dims.h;
      }
      if (!sourceW || !sourceH) {
        throw Object.assign(new Error("Missing image dimensions"), { code: "invalid_crop" });
      }
      const versionId = sourceVer?.id;

      let job: Job;
      const exportOpts = {
        exportFormat,
        exportQuality,
        stripMetadata,
      };
      if (selectedTool === "crop") {
        const box = centerCropBox(sourceW, sourceH, cropAspect);
        job = await tool.run({
          projectId,
          imageId: image.id,
          versionId,
          crop: box,
          rotate,
          flipH,
          flipV,
          ...exportOpts,
        });
      } else if (selectedTool === "resize") {
        job = await tool.run({
          projectId,
          imageId: image.id,
          versionId,
          aspectRatio: aspect === "custom" ? undefined : aspect,
          width: aspect === "custom" ? width : undefined,
          height: aspect === "custom" ? height : undefined,
          fit: aspect === "custom" ? fit : undefined,
          ...exportOpts,
        });
      } else if (selectedTool === "object_remove") {
        if (!maskBlob) throw Object.assign(new Error("Paint a mask first"), { code: "mask_required" });
        const maskStorageKey = await uploadMask(projectId, maskBlob);
        job = await tool.run({
          projectId,
          imageId: image.id,
          versionId,
          maskStorageKey,
          ...exportOpts,
        });
      } else if (selectedTool === "upscale") {
        job = await tool.run({
          projectId,
          imageId: image.id,
          versionId,
          scale: upscaleScale,
          ...exportOpts,
        });
      } else if (selectedTool === "bg_replace") {
        job = await tool.run({
          projectId,
          imageId: image.id,
          versionId,
          color: bgColor,
          dropShadow,
          subjectScale,
          position,
          ...exportOpts,
        });
      } else if (selectedTool === "enhance") {
        job = await tool.run({
          projectId,
          imageId: image.id,
          versionId,
          enhanceManual,
          brightness,
          contrast,
          saturation,
          sharpen,
          warmth,
          ...exportOpts,
        });
      } else {
        job = await tool.run({
          projectId,
          imageId: image.id,
          versionId,
          ...exportOpts,
        });
      }

      if (job.status === "FAILED") {
        throw Object.assign(new Error("failed"), { code: "ai_failed" });
      }

      setStatus(processingCopy(selectedTool, "end"));
      await loadProject(projectId);
      if (job.result_version_id) setActiveVersionId(job.result_version_id);
      if (user) await refresh();
      setLastCreditsUsed(job.credits_deducted ? job.credit_cost || 0 : 0);
      if (job.credits_deducted && job.credit_cost) {
        setSessionCredits((n) => n + (job.credit_cost || 0));
      }
      setStatus("");
    } catch (e) {
      const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
      if (code === "guest_limit_jobs" || code === "guest_limit_images") {
        setAuthReason(code === "guest_limit_jobs" ? "job_limit" : "new_upload");
        setAuthOpen(true);
      } else {
        setError(friendlyError(e));
      }
      setStatus("");
    } finally {
      window.clearTimeout(midTimer);
      setBusy(false);
    }
  }

  async function download(format?: string, opts?: { skipAuthGate?: boolean }) {
    if (!processed) return;
    const hasUserToken =
      typeof window !== "undefined" && !!localStorage.getItem("photopol_token");
    if (!opts?.skipAuthGate && !user && !hasUserToken) {
      setPendingDownload(true);
      setAuthReason("download");
      setAuthOpen(true);
      return;
    }
    try {
      const q = format ? `?format=${format}` : "";
      const blob = await apiBlob(`/projects/versions/${processed.id}/download${q}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `photopol.${format || "png"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
      if (code === "auth_required_download") {
        setPendingDownload(true);
        setAuthReason("download");
        setAuthOpen(true);
      } else {
        setError(friendlyError(e));
      }
    }
  }

  async function onAuthSuccess(claimedProjectId: string | null) {
    setAuthOpen(false);
    await refresh();
    const pid = claimedProjectId || projectId;
    if (pid) {
      setProjectId(pid);
      router.replace(`/workspace?project=${pid}`);
      await loadProject(pid);
    }
    if (pendingDownload) {
      setPendingDownload(false);
      await download(exportFormat, { skipAuthGate: true });
    }
  }

  function clearWorkspace() {
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(null);
    setImage(null);
    setProjectId(null);
    setUploadReady(false);
    setError("");
    setStatus("");
    setStep("upload");
    setActiveVersionId(null);
    setSessionCredits(0);
    setOutcomeAnalysis(null);
    setIntentPhase("choose");
    setLastImproved([]);
    setEditorMode(forceAdvanced ? "advanced" : "intent");
    setSelectedOutcome(outcomeParam || null);
    setCustomIntent("");
    setOutcomeLabel(null);
    setVariantMap({});
    setGeneratingVariant(null);
    setShowMoreChips(false);
    setActiveChip(null);
    router.replace("/workspace");
  }

  async function runIntentOutcome(opts?: {
    outcome?: OutcomeId;
    intentText?: string;
    variant?: VariationId;
    bgColor?: string;
    projectId?: string;
    image?: ImageItem;
    versionId?: string;
  }) {
    const pid = opts?.projectId || projectId;
    const img = opts?.image || image;
    if (!pid || !img) return;
    const outcome =
      opts?.outcome ||
      (opts?.intentText ? inferOutcomeFromText(opts.intentText) : null) ||
      selectedOutcome ||
      "store_ready";
    const intentText = opts?.intentText ?? (outcome === "custom" ? customIntent : undefined);
    const orig = img.versions.find((v) => v.kind === "ORIGINAL");
    setBusy(true);
    setError("");
    setStatus("Photopol is editing…");
    setLastImproved([]);
    try {
      const res = await runOutcome({
        projectId: pid,
        imageId: img.id,
        outcome: opts?.variant ? VARIATIONS.find((v) => v.id === opts.variant)?.outcome || outcome : outcome,
        versionId: opts?.versionId || orig?.id || outcomeAnalysis?.version_id,
        intentText,
        bgColor: opts?.bgColor,
        exportPack: false,
        variant: opts?.variant,
      });
      const loaded = await loadProject(pid, { analyze: false });
      if (res.result_version_id) {
        setActiveVersionId(res.result_version_id);
        if (opts?.variant && loaded) {
          const ver = loaded.versions.find((v) => v.id === res.result_version_id);
          if (ver?.url) {
            setVariantMap((m) => ({
              ...m,
              [opts.variant!]: { versionId: ver.id, url: ver.url },
            }));
          }
        }
      }
      setLastImproved(
        res.what_we_improved?.length
          ? res.what_we_improved
          : OUTCOMES.find((o) => o.id === outcome)?.improves || []
      );
      setOutcomeLabel(res.outcome_label || null);
      setSelectedOutcome(outcome);
      const charged = res.credits_charged || 0;
      if (charged) {
        setSessionCredits((n) => n + charged);
        setLastCreditsUsed(charged);
      }
      if (res.pack?.download_url) window.open(res.pack.download_url, "_blank");
      if (user) await refresh();
      setIntentPhase("result");
      setStatus("");
    } catch (e) {
      const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
      if (code === "guest_limit_jobs" || code === "guest_limit_images") {
        setAuthReason(code === "guest_limit_jobs" ? "job_limit" : "new_upload");
        setAuthOpen(true);
      } else {
        setError(friendlyError(e));
      }
      setStatus("");
    } finally {
      setBusy(false);
      setGeneratingVariant(null);
    }
  }

  function handleChip(id: IntentChipId) {
    setActiveChip(id);
    if (id === "more") {
      setShowMoreChips(true);
      return;
    }
    const chip = INTENT_CHIPS.find((c) => c.id === id);
    if (chip?.outcome) {
      setSelectedOutcome(chip.outcome);
      void runIntentOutcome({ outcome: chip.outcome });
    }
  }

  function handleSubmitIntent() {
    const text = customIntent.trim();
    if (text) {
      setActiveChip(null);
      setSelectedOutcome("custom");
      void runIntentOutcome({ outcome: "custom", intentText: text });
      return;
    }
    if (selectedOutcome) void runIntentOutcome({ outcome: selectedOutcome });
  }

  async function handleVariant(id: VariationId) {
    const existing = variantMap[id];
    if (existing) {
      setActiveVersionId(existing.versionId);
      setIntentPhase("result");
      return;
    }
    const def = VARIATIONS.find((v) => v.id === id);
    if (!def) return;
    setGeneratingVariant(id);
    await runIntentOutcome({
      outcome: def.outcome,
      variant: id,
      bgColor: def.bgColor,
    });
  }

  const hasPreview = !!(beforeUrl || image);

  const stepBar = (
    <div className="flex items-center justify-center gap-2 text-sm md:gap-4">
      {(
        [
          [1, "Upload", "upload"],
          [2, "Edit", "edit"],
          [3, "Download", "download"],
        ] as const
      ).map(([n, label, s]) => {
        const active = step === s;
        const done =
          (s === "upload" && hasPreview) ||
          (s === "edit" && !!processed) ||
          (s === "download" && step === "download");
        const canGo = n === 1 || (n === 2 && hasPreview) || (n === 3 && !!processed);
        return (
          <button
            key={n}
            type="button"
            disabled={!canGo}
            onClick={() => {
              if (n === 1) clearWorkspace();
              else if (canGo) setStep(s);
            }}
            className="flex items-center gap-2 disabled:opacity-40"
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                active
                  ? "bg-[var(--accent)] text-white"
                  : done
                    ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                    : "bg-[#eef0f5] text-[var(--muted)]"
              }`}
            >
              {n}
            </span>
            <span className={active ? "font-medium text-[var(--text)]" : "text-[var(--muted)]"}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );

  const topRight = user ? (
    <div className="flex items-center gap-2">
      <CreditChip balance={user.credit_balance} />
      <Link href="/billing" className="btn btn-primary min-h-9 px-3 text-sm">
        Upgrade
      </Link>
    </div>
  ) : (
    <button
      type="button"
      className="btn btn-ghost min-h-9 px-3 text-sm"
      onClick={() => {
        setAuthReason("generic");
        setAuthOpen(true);
      }}
    >
      Sign in
    </button>
  );

  const body = (
    <>
      <AuthModal
        open={authOpen}
        reason={authReason}
        onClose={() => setAuthOpen(false)}
        onSuccess={(id) => void onAuthSuccess(id)}
      />

      {!hasPreview ? (
        <div className="flex min-h-[100dvh] flex-col bg-[var(--bg)]">
          <header className="flex items-center justify-between border-b border-[var(--border)] bg-white px-4 py-3">
            <Link href={user ? "/home" : "/"} className="brand-mark text-xl">
              Photopol
            </Link>
            {topRight}
          </header>
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 fade-in">
            <div className="mb-6 max-w-md text-center">
              <h1 className="text-2xl font-bold tracking-tight">Edit Image</h1>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Upload a photo. Tell Photopol the result you want — AI handles the rest.
              </p>
            </div>
            <UploadZone onFile={(f) => void handleUpload(f)} busy={busy} />
            {error && (
              <div className="mt-6 max-w-md">
                <ErrorBanner message={error} onRetry={() => setError("")} />
              </div>
            )}
          </div>
        </div>
      ) : step === "download" && processed ? (
        <div className="min-h-[100dvh] bg-[var(--bg)]">
          <header className="flex items-center justify-between border-b border-[var(--border)] bg-white px-4 py-3">
            <button
              type="button"
              className="text-sm text-[var(--muted)] hover:text-[var(--text)]"
              onClick={() => setStep("edit")}
            >
              ← Back to Edit
            </button>
            {stepBar}
            {topRight}
          </header>
          <DownloadPanel
            previewUrl={processed.url}
            width={processed.width}
            height={processed.height}
            format={exportFormat}
            onFormat={setExportFormat}
            busy={busy}
            creditsUsed={lastCreditsUsed}
            creditsRemaining={user?.credit_balance ?? null}
            onDownload={() => void download(exportFormat)}
            onExportPack={(group) => {
              void (async () => {
                if (!projectId || !image || !processed) return;
                setBusy(true);
                setError("");
                try {
                  const pack = await createExportPack({
                    projectId,
                    imageId: image.id,
                    versionId: processed.id,
                    group,
                    format: exportFormat === "png" ? "png" : "jpg",
                    quality: exportQuality,
                  });
                  window.open(pack.download_url, "_blank");
                } catch (e) {
                  setError(friendlyError(e));
                } finally {
                  setBusy(false);
                }
              })();
            }}
            onAnother={clearWorkspace}
            onBack={() => {
              setStep("edit");
              setIntentPhase(processed ? "result" : "choose");
            }}
          />
        </div>
      ) : editorMode === "intent" ? (
        <IntelligenceWorkspace
          previewUrl={beforeUrl}
          afterUrl={afterUrl}
          analysis={outcomeAnalysis}
          analyzing={analyzing}
          selected={selectedOutcome}
          customText={customIntent}
          onCustomText={setCustomIntent}
          busy={busy}
          status={status}
          creditsBalance={user?.credit_balance ?? null}
          creditsUsedMonth={sessionCredits}
          creditsAllowance={
            user?.plan_id === "business" ? 2000 : user?.plan_id === "pro" ? 500 : 0
          }
          lastJobCredits={lastCreditsUsed}
          isGuest={!user}
          lastImproved={lastImproved}
          outcomeLabel={outcomeLabel}
          phase={intentPhase}
          activeChip={activeChip}
          onChip={handleChip}
          showMoreChips={showMoreChips}
          variants={variantMap}
          generatingVariant={generatingVariant}
          onRunVariant={(id) => void handleVariant(id)}
          onSubmitIntent={handleSubmitIntent}
          onDownload={() => {
            if (processed) void download(exportFormat);
          }}
          onMakeAnother={() => {
            setIntentPhase("choose");
            setActiveChip(null);
          }}
          onAskAi={() => {
            setIntentPhase("choose");
          }}
          onAdvanced={() => setEditorMode("advanced")}
          onNewUpload={clearWorkspace}
          onViewOriginal={() => {
            // Peek original: clear processed selection; user can re-run or pick a version again
            if (original?.id) setActiveVersionId(original.id);
          }}
          userName={user?.full_name || user?.email}
          error={
            error ? (
              <ErrorBanner
                message={error}
                onRetry={() => {
                  setError("");
                  void runIntentOutcome();
                }}
              />
            ) : null
          }
        />
      ) : (
        <StudioEditor
          tool={selectedTool}
          onTool={setSelectedTool}
          liveOptions={{
            aspect,
            onAspect: setAspect,
            width,
            height,
            onWidth: setWidth,
            onHeight: setHeight,
            cropAspect,
            onCropAspect: setCropAspect,
            upscaleScale,
            onUpscaleScale: setUpscaleScale,
            bgColor,
            onBgColor: setBgColor,
            brushSize,
            onBrushSize: setBrushSize,
            dropShadow,
            onDropShadow: setDropShadow,
            subjectScale,
            onSubjectScale: setSubjectScale,
            position,
            onPosition: setPosition,
            fit,
            onFit: setFit,
            enhanceManual,
            onEnhanceManual: setEnhanceManual,
            brightness,
            onBrightness: setBrightness,
            contrast,
            onContrast: setContrast,
            saturation,
            onSaturation: setSaturation,
            sharpen,
            onSharpen: setSharpen,
            warmth,
            onWarmth: setWarmth,
            exportFormat,
            onExportFormat: setExportFormat,
            exportQuality,
            onExportQuality: setExportQuality,
            stripMetadata,
            onStripMetadata: setStripMetadata,
            rotate,
            onRotate: setRotate,
            flipH,
            onFlipH: setFlipH,
            flipV,
            onFlipV: setFlipV,
          }}
          eraseImageUrl={beforeUrl}
          onMaskReady={setMaskBlob}
          onApply={() => void runApply()}
          onDownload={() => {
            if (processed) setStep("download");
          }}
          onProductPipeline={() => {
            void (async () => {
              if (!projectId || !image) return;
              setBusy(true);
              setStatus("Making marketplace-ready…");
              setError("");
              try {
                const res = await runProductPipeline({
                  projectId,
                  imageId: image.id,
                  versionId: activeVersionId,
                  bgColor: "#FFFFFF",
                });
                await loadProject(projectId, { analyze: false });
                if (res.result_version_id) setActiveVersionId(res.result_version_id);
                if (res.pack?.download_url) window.open(res.pack.download_url, "_blank");
                if (user) await refresh();
              } catch (e) {
                setError(friendlyError(e));
              } finally {
                setBusy(false);
                setStatus("");
              }
            })();
          }}
          onNewUpload={clearWorkspace}
          onBack={() => setEditorMode("intent")}
          busy={busy}
          disabled={!uploadReady}
          cost={cost}
          isGuest={!user}
          beforeUrl={beforeUrl}
          afterUrl={afterUrl}
          processing={busy ? status || "Working…" : null}
          canDownload={!!processed}
          thumbUrl={original?.url || beforeUrl}
          versions={image?.versions || []}
          activeVersionId={activeVersionId || processed?.id || original?.id}
          onSelectVersion={setActiveVersionId}
          showCompare={showCompare && !!afterUrl}
          onToggleCompare={() => setShowCompare((v) => !v)}
          sessionCredits={sessionCredits}
          topRight={topRight}
          error={
            error ? (
              <ErrorBanner
                message={error}
                onRetry={() => {
                  setError("");
                  void runApply();
                }}
              />
            ) : null
          }
        />
      )}
    </>
  );

  return <div className="h-[100dvh] overflow-hidden bg-[var(--bg)]">{body}</div>;
}
