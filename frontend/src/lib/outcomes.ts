/** User-facing results — never tool SKUs in primary copy. */

export type OutcomeId = "store_ready" | "professional" | "ig_ad" | "custom";

export type OutcomeDef = {
  id: OutcomeId;
  label: string;
  blurb: string;
  improves: string[];
};

/** Mockup chips under the canvas */
export type IntentChipId = "store_ready" | "professional" | "ig_ad" | "ig_post" | "more";

export const INTENT_CHIPS: { id: IntentChipId; label: string; outcome: OutcomeId | null }[] = [
  { id: "store_ready", label: "Ready for Online Store", outcome: "store_ready" },
  { id: "professional", label: "Make it Professional", outcome: "professional" },
  { id: "ig_ad", label: "Create an Advertisement", outcome: "ig_ad" },
  { id: "ig_post", label: "Instagram Post", outcome: "ig_ad" },
  { id: "more", label: "More Options", outcome: null },
];

export type VariationId =
  | "premium_look"
  | "white_bg"
  | "lifestyle"
  | "ig_square"
  | "ig_story";

export type VariationDef = {
  id: VariationId;
  label: string;
  /** Maps to backend variant + outcome defaults */
  outcome: OutcomeId;
  bgColor?: string;
};

export const VARIATIONS: VariationDef[] = [
  { id: "premium_look", label: "Premium Look", outcome: "store_ready", bgColor: "#1C1917" },
  { id: "white_bg", label: "White Background", outcome: "store_ready", bgColor: "#FFFFFF" },
  { id: "lifestyle", label: "Lifestyle Scene", outcome: "store_ready", bgColor: "#F5F0E8" },
  { id: "ig_square", label: "Instagram Square", outcome: "ig_ad", bgColor: "#F5F0E8" },
  { id: "ig_story", label: "Instagram Story", outcome: "ig_ad", bgColor: "#F5F0E8" },
];

export const OUTCOMES: OutcomeDef[] = [
  {
    id: "store_ready",
    label: "Ready for Online Store",
    blurb: "Polish and clean cutout — ready for your shop.",
    improves: [
      "Enhanced lighting and color",
      "Sharpened product details",
      "Removed distracting background",
    ],
  },
  {
    id: "professional",
    label: "Make it Professional",
    blurb: "Enhance and cut out so the photo feels finished.",
    improves: [
      "Enhanced lighting and color",
      "Sharpened product details",
      "Removed distracting background",
    ],
  },
  {
    id: "ig_ad",
    label: "Create an Advertisement",
    blurb: "Polish and cutout ready for ads & feed.",
    improves: [
      "Enhanced lighting and color",
      "Sharpened product details",
      "Removed distracting background",
    ],
  },
  {
    id: "custom",
    label: "Describe what you want",
    blurb: "Tell Photopol in plain language — AI edits this photo for you.",
    improves: [
      "Applied your request with AI",
      "Edited this photo from your description",
    ],
  },
];

export function parseOutcomeParam(raw: string | null): OutcomeId | null {
  if (!raw) return null;
  const v = raw.toLowerCase().trim();
  if (v === "store_ready" || v === "store" || v === "shop" || v === "marketplace") return "store_ready";
  if (v === "professional" || v === "pro" || v === "polish") return "professional";
  if (v === "ig_ad" || v === "instagram" || v === "ig" || v === "ad") return "ig_ad";
  if (v === "custom") return "custom";
  return null;
}

export function inferOutcomeFromText(text: string): OutcomeId {
  const t = text.toLowerCase();
  if (/\b(store|shop|amazon|shopify|etsy|ebay|marketplace|listing|ecommerce|e-?commerce)\b/.test(t)) {
    return "store_ready";
  }
  if (/\b(instagram|ig\b|reel|story|ad|ads|social|tiktok|feed)\b/.test(t)) {
    return "ig_ad";
  }
  if (/\b(professional|polish|look better|fix|improve|enhance|quality)\b/.test(t)) {
    return "professional";
  }
  return "professional";
}
