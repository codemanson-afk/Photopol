import { api } from "@/lib/api";
import type { Job } from "@/lib/types";

export type ToolId =
  | "remove_bg"
  | "resize"
  | "crop"
  | "object_remove"
  | "upscale"
  | "enhance"
  | "bg_replace";

export type ToolRunContext = {
  projectId: string;
  imageId: string;
  versionId?: string | null;
  modelId?: string;
  /** Resize */
  aspectRatio?: string;
  width?: number;
  height?: number;
  fit?: string;
  /** Crop box in image pixels */
  crop?: { x: number; y: number; width: number; height: number };
  rotate?: number;
  flipH?: boolean;
  flipV?: boolean;
  /** Object remove */
  maskStorageKey?: string;
  /** Upscale */
  scale?: 2 | 4;
  /** Bg replace */
  color?: string;
  prompt?: string;
  dropShadow?: boolean;
  subjectScale?: number;
  position?: string;
  /** Enhance manual */
  enhanceManual?: boolean;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  sharpen?: number;
  warmth?: number;
  /** Export encode */
  exportFormat?: string;
  exportQuality?: number;
  stripMetadata?: boolean;
};

export type ToolDef = {
  id: ToolId;
  label: string;
  description: string;
  credits: number;
  planMin?: "free" | "pro" | "business";
  run: (ctx: ToolRunContext) => Promise<Job>;
};

const TERMINAL = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

export async function pollJob(jobId: string, opts?: { intervalMs?: number; timeoutMs?: number }): Promise<Job> {
  const interval = opts?.intervalMs ?? 1500;
  const timeout = opts?.timeoutMs ?? 5 * 60 * 1000;
  const start = Date.now();
  let job = await api<Job>(`/jobs/${jobId}`);
  while (!TERMINAL.has(job.status)) {
    if (Date.now() - start > timeout) {
      throw new Error("Job timed out — check History");
    }
    await new Promise((r) => setTimeout(r, interval));
    job = await api<Job>(`/jobs/${jobId}`);
  }
  return job;
}

async function createAndWait(body: Record<string, unknown>): Promise<Job> {
  const job = await api<Job>("/jobs", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (TERMINAL.has(job.status)) return job;
  return pollJob(job.id);
}

async function runViaJobs(tool: ToolId, ctx: ToolRunContext, params: Record<string, unknown> = {}): Promise<Job> {
  return createAndWait({
    project_id: ctx.projectId,
    image_id: ctx.imageId,
    version_id: ctx.versionId || undefined,
    tool,
    model_id: ctx.modelId || undefined,
    params,
    idempotency_key: `${tool}-${ctx.imageId}-${Date.now()}`,
  });
}

function exportParams(ctx: ToolRunContext): Record<string, unknown> {
  if (!ctx.exportFormat) return {};
  return {
    export_format: ctx.exportFormat,
    export_quality: ctx.exportQuality ?? 92,
    strip_metadata: ctx.stripMetadata ?? true,
  };
}

async function runRemoveBg(ctx: ToolRunContext): Promise<Job> {
  return runViaJobs("remove_bg", ctx, { ...exportParams(ctx) });
}

async function runResize(ctx: ToolRunContext): Promise<Job> {
  return runViaJobs("resize", ctx, {
    aspect_ratio: ctx.aspectRatio || undefined,
    width: ctx.width || undefined,
    height: ctx.height || undefined,
    fit: ctx.fit || undefined,
    ...exportParams(ctx),
  });
}

async function runCrop(ctx: ToolRunContext): Promise<Job> {
  if (!ctx.crop) throw new Error("Crop region required");
  return runViaJobs("crop", ctx, {
    x: ctx.crop.x,
    y: ctx.crop.y,
    width: ctx.crop.width,
    height: ctx.crop.height,
    rotate: ctx.rotate || 0,
    flip_h: !!ctx.flipH,
    flip_v: !!ctx.flipV,
    ...exportParams(ctx),
  });
}

async function runObjectRemove(ctx: ToolRunContext): Promise<Job> {
  if (!ctx.maskStorageKey) throw new Error("Paint a mask first");
  return runViaJobs("object_remove", ctx, {
    mask_storage_key: ctx.maskStorageKey,
    ...exportParams(ctx),
  });
}

async function runUpscale(ctx: ToolRunContext): Promise<Job> {
  const scale = ctx.scale || 2;
  const modelId = scale === 4 ? "upscale-4x" : "upscale-2x";
  return runViaJobs("upscale", { ...ctx, modelId: ctx.modelId || modelId }, {
    scale,
    ...exportParams(ctx),
  });
}

async function runEnhance(ctx: ToolRunContext): Promise<Job> {
  if (ctx.enhanceManual) {
    return runViaJobs("enhance", ctx, {
      manual: true,
      brightness: ctx.brightness ?? 0,
      contrast: ctx.contrast ?? 0,
      saturation: ctx.saturation ?? 0,
      sharpen: ctx.sharpen ?? 0,
      warmth: ctx.warmth ?? 0,
      ...exportParams(ctx),
    });
  }
  return runViaJobs("enhance", ctx, { ...exportParams(ctx) });
}

async function runBgReplace(ctx: ToolRunContext): Promise<Job> {
  return runViaJobs("bg_replace", ctx, {
    color: ctx.color || "#8B5CF6",
    prompt: ctx.prompt || undefined,
    drop_shadow: !!ctx.dropShadow,
    subject_scale: ctx.subjectScale ?? 100,
    position: ctx.position || "center",
    ...exportParams(ctx),
  });
}

export async function uploadMask(projectId: string, blob: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", blob, "mask.png");
  const res = await api<{ mask_storage_key: string }>(`/projects/${projectId}/masks`, {
    method: "POST",
    body: form,
  });
  return res.mask_storage_key;
}

export async function createExportPack(body: {
  projectId: string;
  imageId: string;
  versionId?: string | null;
  group: "social" | "marketplace";
  format?: string;
  quality?: number;
}): Promise<{ download_url: string; file_count: number }> {
  return api("/exports/packs", {
    method: "POST",
    body: JSON.stringify({
      project_id: body.projectId,
      image_id: body.imageId,
      version_id: body.versionId || undefined,
      group: body.group,
      format: body.format || "jpg",
      quality: body.quality ?? 92,
    }),
  });
}

export async function runProductPipeline(body: {
  projectId: string;
  imageId: string;
  versionId?: string | null;
  bgColor?: string;
}): Promise<{ pack: { download_url: string }; result_version_id: string }> {
  return api("/exports/pipelines/product", {
    method: "POST",
    body: JSON.stringify({
      project_id: body.projectId,
      image_id: body.imageId,
      version_id: body.versionId || undefined,
      bg_color: body.bgColor || "#FFFFFF",
      drop_shadow: true,
    }),
  });
}

export type AutoEditFix = {
  id: string;
  label: string;
  reason: string;
  tool: string;
  credits: number;
  included: boolean;
};

export type AutoEditAnalysis = {
  recipe: string;
  recipe_label: string;
  recipe_credits: number;
  width: number;
  height: number;
  version_id: string;
  fixes: AutoEditFix[];
  summary: string;
};

export type AutoEditResult = {
  pipeline: string;
  recipe_label: string;
  session_id: string;
  job_ids: string[];
  steps_applied: string[];
  credits_charged: number;
  recipe_credits_estimate: number;
  result_version_id: string | null;
  fixes: AutoEditFix[];
  summary: string;
};

export async function analyzeAutoEdit(body: {
  projectId: string;
  imageId: string;
  versionId?: string | null;
}): Promise<AutoEditAnalysis> {
  return api("/exports/pipelines/auto-edit/analyze", {
    method: "POST",
    body: JSON.stringify({
      project_id: body.projectId,
      image_id: body.imageId,
      version_id: body.versionId || undefined,
    }),
  });
}

export async function runAutoEdit(body: {
  projectId: string;
  imageId: string;
  versionId?: string | null;
  bgColor?: string;
}): Promise<AutoEditResult> {
  return api("/exports/pipelines/auto-edit/run", {
    method: "POST",
    body: JSON.stringify({
      project_id: body.projectId,
      image_id: body.imageId,
      version_id: body.versionId || undefined,
      bg_color: body.bgColor || "#FFFFFF",
    }),
  });
}

export type OutcomeCard = {
  id: string;
  label: string;
  blurb: string;
  improves: string[];
  credits: number;
  recommended: boolean;
};

export type OutcomeAnalysis = {
  insight: string;
  recommended: string;
  width: number;
  height: number;
  version_id: string;
  outcomes: OutcomeCard[];
  can_studio_bg: boolean;
  needs_upscale: boolean;
  needs_fit: boolean;
};

export type OutcomeResult = {
  pipeline: string;
  outcome: string;
  variant?: string | null;
  outcome_label: string;
  session_id: string;
  job_ids: string[];
  steps_applied: string[];
  credits_charged: number;
  recipe_credits_estimate: number;
  result_version_id: string | null;
  what_we_improved: string[];
  summary: string;
  insight?: string;
  pack?: { download_url?: string } | null;
};

export async function analyzeOutcomes(body: {
  projectId: string;
  imageId: string;
  versionId?: string | null;
}): Promise<OutcomeAnalysis> {
  return api("/exports/pipelines/outcomes/analyze", {
    method: "POST",
    body: JSON.stringify({
      project_id: body.projectId,
      image_id: body.imageId,
      version_id: body.versionId || undefined,
    }),
  });
}

export async function runOutcome(body: {
  projectId: string;
  imageId: string;
  outcome: string;
  versionId?: string | null;
  intentText?: string;
  bgColor?: string;
  exportPack?: boolean;
  variant?: string;
}): Promise<OutcomeResult> {
  return api("/exports/pipelines/outcomes/run", {
    method: "POST",
    body: JSON.stringify({
      project_id: body.projectId,
      image_id: body.imageId,
      outcome: body.outcome,
      version_id: body.versionId || undefined,
      intent_text: body.intentText || undefined,
      bg_color: body.bgColor || "#FFFFFF",
      export_pack: !!body.exportPack,
      variant: body.variant || undefined,
    }),
  });
}

/** Only tools that ship in the product. */
export const LIVE_TOOLS: ToolDef[] = [
  {
    id: "remove_bg",
    label: "Remove Background",
    description: "Cut out the subject. Transparent PNG result.",
    credits: 5,
    run: runRemoveBg,
  },
  {
    id: "object_remove",
    label: "Object Remove",
    description: "Brush over what you want gone.",
    credits: 8,
    run: runObjectRemove,
  },
  {
    id: "upscale",
    label: "Upscale",
    description: "2× or 4× dedicated upscale.",
    credits: 6,
    run: runUpscale,
  },
  {
    id: "enhance",
    label: "Enhance",
    description: "Sharpen, contrast, and color polish.",
    credits: 4,
    run: runEnhance,
  },
  {
    id: "bg_replace",
    label: "Background Replace",
    description: "Cut out and drop onto a solid color.",
    credits: 12,
    planMin: "pro",
    run: runBgReplace,
  },
  {
    id: "resize",
    label: "Resize",
    description: "Change size with aspect presets or custom dimensions.",
    credits: 1,
    run: runResize,
  },
  {
    id: "crop",
    label: "Crop",
    description: "Frame the image to an aspect ratio you choose.",
    credits: 1,
    run: runCrop,
  },
];

export function getTool(id: string): ToolDef | undefined {
  return LIVE_TOOLS.find((t) => t.id === id);
}

export const ASPECT_PRESETS = ["1:1", "4:5", "16:9", "9:16"] as const;

/** Extra ratios for crop UI (live when selected). */
export const CROP_ASPECT_PRESETS = [
  "Free",
  "Original",
  "1:1",
  "4:5",
  "5:4",
  "3:2",
  "2:3",
  "16:9",
  "9:16",
  "21:9",
] as const;

/** Social / platform size chips for resize (maps to W×H when picked). */
export const SOCIAL_SIZE_PRESETS: ReadonlyArray<{
  id: string;
  label: string;
  width: number;
  height: number;
  aspect: string;
}> = [
  { id: "ig-post", label: "IG Post", width: 1080, height: 1080, aspect: "1:1" },
  { id: "ig-portrait", label: "IG 4:5", width: 1080, height: 1350, aspect: "4:5" },
  { id: "ig-story", label: "IG Story", width: 1080, height: 1920, aspect: "9:16" },
  { id: "tiktok", label: "TikTok", width: 1080, height: 1920, aspect: "9:16" },
  { id: "yt-thumb", label: "YT Thumb", width: 1280, height: 720, aspect: "16:9" },
  { id: "yt-short", label: "YT Short", width: 1080, height: 1920, aspect: "9:16" },
  { id: "linkedin", label: "LinkedIn", width: 1200, height: 627, aspect: "1.91:1" },
  { id: "x-post", label: "X Post", width: 1600, height: 900, aspect: "16:9" },
  { id: "fb-cover", label: "FB Cover", width: 820, height: 312, aspect: "custom" },
  { id: "pinterest", label: "Pinterest", width: 1000, height: 1500, aspect: "2:3" },
];

/** Marketplace ZIP pack — keep in sync with backend export_presets.MARKETPLACE_PRESETS */
export const MARKETPLACE_SIZE_PRESETS: ReadonlyArray<{
  id: string;
  label: string;
  width: number;
  height: number;
}> = [
  { id: "amazon-main", label: "Amazon Main", width: 2000, height: 2000 },
  { id: "amazon-variant", label: "Amazon Variant", width: 1600, height: 1600 },
  { id: "shopify-square", label: "Shopify", width: 2048, height: 2048 },
  { id: "etsy-tall", label: "Etsy", width: 2000, height: 2500 },
  { id: "ebay-gallery", label: "eBay", width: 1600, height: 1600 },
];

/** Centered crop box for a given aspect inside image dims. */
export function centerCropBox(
  imgW: number,
  imgH: number,
  aspect: string
): { x: number; y: number; width: number; height: number } {
  const [aw, ah] = aspect.split(":").map(Number);
  const target = aw / ah;
  const current = imgW / imgH;
  if (current > target) {
    const width = Math.floor(imgH * target);
    const height = imgH;
    const x = Math.floor((imgW - width) / 2);
    return { x, y: 0, width, height };
  }
  const width = imgW;
  const height = Math.floor(imgW / target);
  const y = Math.floor((imgH - height) / 2);
  return { x: 0, y, width, height };
}

/** @deprecated use LIVE_TOOLS */
export const TOOL_COST: Record<string, number> = Object.fromEntries(
  LIVE_TOOLS.map((t) => [t.id, t.credits])
);

export type IntentAction =
  | "background_removal"
  | "resize"
  | "crop"
  | "object_remove"
  | "upscale"
  | "enhance"
  | "bg_replace"
  | "unsupported";

export type ParsedIntent = {
  action: IntentAction;
  aspectRatio?: string;
  label: string;
};

export function parseIntent(text: string, selectedTool?: string | null): ParsedIntent {
  const t = text.trim().toLowerCase();
  if (selectedTool === "remove_bg" || /\b(remove|erase).*(background|bg)\b|\bbackground.*(remov|cut)/.test(t)) {
    return { action: "background_removal", label: "Remove background" };
  }
  if (selectedTool === "object_remove" || /\b(object|spot).*(remov|eras)|inpaint\b/.test(t)) {
    return { action: "object_remove", label: "Object remove" };
  }
  if (selectedTool === "upscale" || /\bupscale|4x|2x\b/.test(t)) {
    return { action: "upscale", label: "Upscale" };
  }
  if (selectedTool === "enhance" || /\benhance|sharpen|denoise\b/.test(t)) {
    return { action: "enhance", label: "Enhance" };
  }
  if (selectedTool === "bg_replace" || /\breplace.*(background|bg)\b/.test(t)) {
    return { action: "bg_replace", label: "Background replace" };
  }
  if (selectedTool === "crop" || /\bcrop\b/.test(t)) {
    return { action: "crop", aspectRatio: "1:1", label: "Crop" };
  }
  if (selectedTool === "resize" || /\b(resize|scale|square|story|instagram)\b/.test(t)) {
    if (/\b(story|9\s*:\s*16|reel)\b/.test(t)) {
      return { action: "resize", aspectRatio: "9:16", label: "Resize 9:16" };
    }
    if (/\b(16\s*:\s*9|youtube|landscape)\b/.test(t)) {
      return { action: "resize", aspectRatio: "16:9", label: "Resize 16:9" };
    }
    if (/\b(4\s*:\s*5|portrait)\b/.test(t)) {
      return { action: "resize", aspectRatio: "4:5", label: "Resize 4:5" };
    }
    return { action: "resize", aspectRatio: "1:1", label: "Resize" };
  }
  if (selectedTool && getTool(selectedTool)) {
    const tool = getTool(selectedTool)!;
    if (tool.id === "remove_bg") return { action: "background_removal", label: tool.label };
    if (tool.id === "crop") return { action: "crop", aspectRatio: "1:1", label: tool.label };
    if (tool.id === "object_remove") return { action: "object_remove", label: tool.label };
    if (tool.id === "upscale") return { action: "upscale", label: tool.label };
    if (tool.id === "enhance") return { action: "enhance", label: tool.label };
    if (tool.id === "bg_replace") return { action: "bg_replace", label: tool.label };
    return { action: "resize", aspectRatio: "1:1", label: tool.label };
  }
  return { action: "unsupported", label: "Choose a tool" };
}
