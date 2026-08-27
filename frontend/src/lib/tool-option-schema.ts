import type { ToolId } from "@/lib/tools";

export type ControlOption = { value: string; label: string; hint?: string };

export type ControlDef =
  | {
      kind: "segment" | "chips";
      id: string;
      label: string;
      live?: boolean;
      options: ControlOption[];
      defaultValue: string;
    }
  | {
      kind: "slider";
      id: string;
      label: string;
      live?: boolean;
      min: number;
      max: number;
      step?: number;
      defaultValue: number;
      unit?: string;
    }
  | {
      kind: "toggle";
      id: string;
      label: string;
      live?: boolean;
      defaultValue: boolean;
    }
  | {
      kind: "color";
      id: string;
      label: string;
      live?: boolean;
      defaultValue: string;
    }
  | {
      kind: "number";
      id: string;
      label: string;
      live?: boolean;
      min?: number;
      max?: number;
      defaultValue: number;
      pairedWith?: string;
    }
  | {
      kind: "select";
      id: string;
      label: string;
      live?: boolean;
      options: ControlOption[];
      defaultValue: string;
    }
  | {
      kind: "swatches";
      id: string;
      label: string;
      live?: boolean;
      colors: string[];
      defaultValue: string;
    }
  | {
      kind: "textarea";
      id: string;
      label: string;
      live?: boolean;
      placeholder?: string;
      defaultValue: string;
    }
  | {
      kind: "button_row";
      id: string;
      label: string;
      live?: boolean;
      options: ControlOption[];
    };

export type OptionSection = {
  id: string;
  title: string;
  /** Entire section is live (rare); usually per-control. */
  live?: boolean;
  controls: ControlDef[];
};

export type ToolOptionsSchema = {
  tool: ToolId;
  sections: OptionSection[];
};

const SWATCHES = [
  "#ffffff",
  "#f5f5f5",
  "#1a1a1e",
  "#1e3a5f",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
  "#f59e0b",
  "#22c55e",
];

export const EXPORT_SECTION: OptionSection = {
  id: "export",
  title: "Export",
  live: true,
  controls: [
    {
      kind: "segment",
      id: "export_format",
      label: "Format",
      live: true,
      defaultValue: "png",
      options: [
        { value: "png", label: "PNG" },
        { value: "jpg", label: "JPG" },
        { value: "webp", label: "WebP" },
      ],
    },
    {
      kind: "slider",
      id: "jpg_quality",
      label: "JPG quality",
      live: true,
      min: 40,
      max: 100,
      step: 1,
      defaultValue: 92,
      unit: "%",
    },
    {
      kind: "toggle",
      id: "strip_metadata",
      label: "Strip metadata",
      live: true,
      defaultValue: true,
    },
    {
      kind: "toggle",
      id: "embed_srgb",
      label: "Embed sRGB profile",
      defaultValue: true,
    },
  ],
};

export const TOOL_OPTION_SCHEMAS: Record<ToolId, ToolOptionsSchema> = {
  remove_bg: {
    tool: "remove_bg",
    sections: [
      {
        id: "quality",
        title: "Quality",
        controls: [
          {
            kind: "segment",
            id: "bg_quality",
            label: "Model",
            defaultValue: "standard",
            options: [
              { value: "fast", label: "Fast" },
              { value: "standard", label: "Standard" },
              { value: "pro", label: "Pro" },
            ],
          },
          {
            kind: "toggle",
            id: "hair_detail",
            label: "Hair & fine edges",
            defaultValue: true,
          },
          {
            kind: "toggle",
            id: "keep_shadows",
            label: "Keep natural shadows",
            defaultValue: false,
          },
          {
            kind: "slider",
            id: "edge_feather",
            label: "Edge feather",
            min: 0,
            max: 20,
            step: 1,
            defaultValue: 2,
            unit: "px",
          },
        ],
      },
      {
        id: "output",
        title: "Output",
        controls: [
          {
            kind: "segment",
            id: "bg_output",
            label: "Background",
            defaultValue: "transparent",
            options: [
              { value: "transparent", label: "Transparent" },
              { value: "white", label: "White" },
              { value: "color", label: "Color" },
            ],
          },
          {
            kind: "swatches",
            id: "bg_fill_color",
            label: "Fill color",
            colors: SWATCHES,
            defaultValue: "#ffffff",
          },
          {
            kind: "segment",
            id: "bg_format",
            label: "Format",
            defaultValue: "png",
            options: [
              { value: "png", label: "PNG" },
              { value: "webp", label: "WebP" },
            ],
          },
        ],
      },
    ],
  },

  object_remove: {
    tool: "object_remove",
    sections: [
      {
        id: "brush",
        title: "Brush",
        controls: [
          {
            kind: "segment",
            id: "erase_mode",
            label: "Mode",
            defaultValue: "brush",
            options: [
              { value: "brush", label: "Brush" },
              { value: "eraser", label: "Eraser" },
              { value: "lasso", label: "Lasso" },
            ],
          },
          {
            kind: "slider",
            id: "brush_size",
            label: "Size",
            min: 8,
            max: 120,
            step: 1,
            defaultValue: 40,
            unit: "px",
          },
          {
            kind: "slider",
            id: "brush_hardness",
            label: "Hardness",
            min: 0,
            max: 100,
            step: 1,
            defaultValue: 80,
            unit: "%",
          },
          {
            kind: "slider",
            id: "brush_opacity",
            label: "Opacity",
            min: 10,
            max: 100,
            step: 1,
            defaultValue: 100,
            unit: "%",
          },
          {
            kind: "slider",
            id: "erase_feather",
            label: "Feather",
            min: 0,
            max: 30,
            step: 1,
            defaultValue: 4,
            unit: "px",
          },
        ],
      },
      {
        id: "ai",
        title: "AI erase",
        controls: [
          {
            kind: "slider",
            id: "erase_strength",
            label: "Fill strength",
            min: 0,
            max: 100,
            step: 1,
            defaultValue: 75,
            unit: "%",
          },
          {
            kind: "toggle",
            id: "auto_detect",
            label: "Auto-detect object",
            defaultValue: false,
          },
          {
            kind: "toggle",
            id: "multi_pass",
            label: "Multi-pass refine",
            defaultValue: true,
          },
        ],
      },
    ],
  },

  upscale: {
    tool: "upscale",
    sections: [
      {
        id: "scale",
        title: "Scale",
        live: true,
        controls: [
          {
            kind: "segment",
            id: "upscale_scale",
            label: "Factor",
            live: true,
            defaultValue: "2",
            options: [
              { value: "2", label: "2×" },
              { value: "4", label: "4× · Pro" },
              { value: "8", label: "8×" },
            ],
          },
        ],
      },
      {
        id: "model",
        title: "Model & refine",
        controls: [
          {
            kind: "segment",
            id: "upscale_model",
            label: "Model",
            defaultValue: "standard",
            options: [
              { value: "standard", label: "Standard" },
              { value: "ultra", label: "Ultra" },
            ],
          },
          {
            kind: "toggle",
            id: "face_enhance",
            label: "Face enhance",
            defaultValue: false,
          },
          {
            kind: "slider",
            id: "upscale_denoise",
            label: "Denoise",
            min: 0,
            max: 100,
            step: 1,
            defaultValue: 30,
            unit: "%",
          },
          {
            kind: "slider",
            id: "upscale_sharpen",
            label: "Sharpen",
            min: 0,
            max: 100,
            step: 1,
            defaultValue: 20,
            unit: "%",
          },
          {
            kind: "segment",
            id: "upscale_format",
            label: "Format",
            defaultValue: "png",
            options: [
              { value: "png", label: "PNG" },
              { value: "jpg", label: "JPG" },
              { value: "webp", label: "WebP" },
            ],
          },
        ],
      },
    ],
  },

  enhance: {
    tool: "enhance",
    sections: [
      {
        id: "presets",
        title: "Presets",
        controls: [
          {
            kind: "chips",
            id: "enhance_preset",
            label: "Look",
            defaultValue: "auto",
            options: [
              { value: "auto", label: "Auto" },
              { value: "manual", label: "Manual" },
              { value: "portrait", label: "Portrait" },
              { value: "product", label: "Product" },
              { value: "landscape", label: "Landscape" },
              { value: "vivid", label: "Vivid" },
              { value: "natural", label: "Natural" },
            ],
          },
        ],
      },
      {
        id: "tone",
        title: "Tone",
        controls: [
          {
            kind: "slider",
            id: "brightness",
            label: "Brightness",
            min: -50,
            max: 50,
            step: 1,
            defaultValue: 0,
          },
          {
            kind: "slider",
            id: "contrast",
            label: "Contrast",
            min: -50,
            max: 50,
            step: 1,
            defaultValue: 0,
          },
          {
            kind: "slider",
            id: "highlights",
            label: "Highlights",
            min: -50,
            max: 50,
            step: 1,
            defaultValue: 0,
          },
          {
            kind: "slider",
            id: "shadows",
            label: "Shadows",
            min: -50,
            max: 50,
            step: 1,
            defaultValue: 0,
          },
        ],
      },
      {
        id: "color",
        title: "Color & detail",
        controls: [
          {
            kind: "slider",
            id: "saturation",
            label: "Saturation",
            min: -50,
            max: 50,
            step: 1,
            defaultValue: 0,
          },
          {
            kind: "slider",
            id: "warmth",
            label: "Warmth",
            min: -50,
            max: 50,
            step: 1,
            defaultValue: 0,
          },
          {
            kind: "slider",
            id: "clarity",
            label: "Clarity",
            min: 0,
            max: 100,
            step: 1,
            defaultValue: 20,
          },
          {
            kind: "slider",
            id: "sharpen",
            label: "Sharpen",
            min: 0,
            max: 100,
            step: 1,
            defaultValue: 25,
          },
          {
            kind: "slider",
            id: "denoise",
            label: "Denoise",
            min: 0,
            max: 100,
            step: 1,
            defaultValue: 15,
          },
          {
            kind: "button_row",
            id: "enhance_reset",
            label: "Reset",
            options: [{ value: "reset", label: "Reset all" }],
          },
        ],
      },
    ],
  },

  bg_replace: {
    tool: "bg_replace",
    sections: [
      {
        id: "solid",
        title: "Solid color",
        live: true,
        controls: [
          {
            kind: "color",
            id: "bg_color",
            label: "Color",
            live: true,
            defaultValue: "#8B5CF6",
          },
          {
            kind: "swatches",
            id: "bg_swatches",
            label: "Studio presets",
            live: true,
            colors: SWATCHES,
            defaultValue: "#8B5CF6",
          },
        ],
      },
      {
        id: "scene",
        title: "Scene",
        controls: [
          {
            kind: "segment",
            id: "bg_mode",
            label: "Mode",
            defaultValue: "solid",
            options: [
              { value: "solid", label: "Solid" },
              { value: "gradient", label: "Gradient" },
              { value: "scene", label: "Scene" },
            ],
          },
          {
            kind: "textarea",
            id: "scene_prompt",
            label: "Scene prompt",
            placeholder: "Soft studio backdrop, morning light…",
            defaultValue: "",
          },
          {
            kind: "slider",
            id: "bg_blur",
            label: "Background blur",
            min: 0,
            max: 40,
            step: 1,
            defaultValue: 0,
            unit: "px",
          },
          {
            kind: "toggle",
            id: "drop_shadow",
            label: "Drop shadow",
            defaultValue: true,
          },
          {
            kind: "slider",
            id: "subject_scale",
            label: "Subject scale",
            min: 50,
            max: 120,
            step: 1,
            defaultValue: 100,
            unit: "%",
          },
          {
            kind: "segment",
            id: "subject_pos",
            label: "Position",
            defaultValue: "center",
            options: [
              { value: "center", label: "Center" },
              { value: "lower", label: "Lower" },
              { value: "floor", label: "Floor" },
            ],
          },
        ],
      },
    ],
  },

  resize: {
    tool: "resize",
    sections: [
      {
        id: "aspect",
        title: "Aspect",
        live: true,
        controls: [
          {
            kind: "chips",
            id: "resize_aspect",
            label: "Ratio",
            live: true,
            defaultValue: "1:1",
            options: [
              { value: "1:1", label: "1:1" },
              { value: "4:5", label: "4:5" },
              { value: "16:9", label: "16:9" },
              { value: "9:16", label: "9:16" },
              { value: "custom", label: "Custom" },
            ],
          },
          {
            kind: "number",
            id: "resize_width",
            label: "Width",
            live: true,
            min: 16,
            max: 8192,
            defaultValue: 1080,
            pairedWith: "resize_height",
          },
          {
            kind: "number",
            id: "resize_height",
            label: "Height",
            live: true,
            min: 16,
            max: 8192,
            defaultValue: 1080,
            pairedWith: "resize_width",
          },
        ],
      },
      {
        id: "social",
        title: "Social sizes",
        live: true,
        controls: [
          {
            kind: "chips",
            id: "social_preset",
            label: "Platform",
            live: true,
            defaultValue: "",
            options: [
              { value: "ig-post", label: "IG Post" },
              { value: "ig-portrait", label: "IG 4:5" },
              { value: "ig-story", label: "IG Story" },
              { value: "tiktok", label: "TikTok" },
              { value: "yt-thumb", label: "YT Thumb" },
              { value: "yt-short", label: "YT Short" },
              { value: "linkedin", label: "LinkedIn" },
              { value: "x-post", label: "X Post" },
              { value: "fb-cover", label: "FB Cover" },
              { value: "pinterest", label: "Pinterest" },
            ],
          },
        ],
      },
      {
        id: "fit",
        title: "Fit & units",
        controls: [
          {
            kind: "segment",
            id: "resize_fit",
            label: "Fit",
            defaultValue: "contain",
            options: [
              { value: "contain", label: "Contain" },
              { value: "cover", label: "Cover" },
              { value: "stretch", label: "Stretch" },
            ],
          },
          {
            kind: "toggle",
            id: "lock_aspect",
            label: "Lock aspect ratio",
            defaultValue: true,
          },
          {
            kind: "segment",
            id: "resize_units",
            label: "Units",
            defaultValue: "px",
            options: [
              { value: "px", label: "px" },
              { value: "percent", label: "%" },
              { value: "in", label: "in" },
            ],
          },
          {
            kind: "select",
            id: "resize_dpi",
            label: "DPI (print)",
            defaultValue: "72",
            options: [
              { value: "72", label: "72 (screen)" },
              { value: "150", label: "150" },
              { value: "300", label: "300 (print)" },
            ],
          },
        ],
      },
    ],
  },

  crop: {
    tool: "crop",
    sections: [
      {
        id: "aspect",
        title: "Aspect",
        live: true,
        controls: [
          {
            kind: "chips",
            id: "crop_aspect",
            label: "Ratio",
            live: true,
            defaultValue: "1:1",
            options: [
              { value: "Free", label: "Free" },
              { value: "Original", label: "Original" },
              { value: "1:1", label: "1:1" },
              { value: "4:5", label: "4:5" },
              { value: "5:4", label: "5:4" },
              { value: "3:2", label: "3:2" },
              { value: "2:3", label: "2:3" },
              { value: "16:9", label: "16:9" },
              { value: "9:16", label: "9:16" },
              { value: "21:9", label: "21:9" },
            ],
          },
        ],
      },
      {
        id: "guides",
        title: "Guides & transform",
        controls: [
          {
            kind: "toggle",
            id: "rule_of_thirds",
            label: "Rule of thirds grid",
            defaultValue: true,
          },
          {
            kind: "slider",
            id: "straighten",
            label: "Straighten",
            min: -45,
            max: 45,
            step: 0.5,
            defaultValue: 0,
            unit: "°",
          },
          {
            kind: "button_row",
            id: "flip",
            label: "Flip",
            options: [
              { value: "h", label: "Flip H" },
              { value: "v", label: "Flip V" },
            ],
          },
          {
            kind: "button_row",
            id: "rotate",
            label: "Rotate",
            options: [
              { value: "-90", label: "−90°" },
              { value: "90", label: "90°" },
            ],
          },
        ],
      },
    ],
  },
};

export function getToolOptionSchema(tool: ToolId): ToolOptionsSchema {
  return TOOL_OPTION_SCHEMAS[tool];
}
