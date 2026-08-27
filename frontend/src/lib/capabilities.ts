import type { ToolId } from "@/lib/tools";

/** Result-first capability groups — underlying ToolIds unchanged. */
export type CapabilityId = "background" | "cleanup" | "quality" | "frame";

export type CapabilityGroup = {
  id: CapabilityId;
  label: string;
  blurb: string;
  tools: ToolId[];
};

export const CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    id: "background",
    label: "Background",
    blurb: "Cut out or place on a clean studio look",
    tools: ["remove_bg", "bg_replace"],
  },
  {
    id: "cleanup",
    label: "Cleanup",
    blurb: "Remove unwanted objects",
    tools: ["object_remove"],
  },
  {
    id: "quality",
    label: "Quality",
    blurb: "Enhance colors and upscale",
    tools: ["enhance", "upscale"],
  },
  {
    id: "frame",
    label: "Frame",
    blurb: "Crop, resize, aspect ratios",
    tools: ["crop", "resize"],
  },
];

export function capabilityForTool(tool: ToolId): CapabilityId {
  for (const g of CAPABILITY_GROUPS) {
    if (g.tools.includes(tool)) return g.id;
  }
  return "background";
}

export function toolsForCapability(id: CapabilityId): ToolId[] {
  return CAPABILITY_GROUPS.find((g) => g.id === id)?.tools ?? [];
}

/** Map SEO / query aliases → capability */
export function parseCapabilityParam(raw: string | null): CapabilityId | null {
  if (!raw) return null;
  const v = raw.toLowerCase().trim();
  if (v === "background" || v === "bg" || v === "cutout" || v === "remove_bg") return "background";
  if (v === "cleanup" || v === "erase" || v === "object_remove") return "cleanup";
  if (v === "quality" || v === "enhance" || v === "upscale") return "quality";
  if (v === "frame" || v === "crop" || v === "resize") return "frame";
  return null;
}
