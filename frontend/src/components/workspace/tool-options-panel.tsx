"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  EXPORT_SECTION,
  getToolOptionSchema,
  type ControlDef,
  type OptionSection,
} from "@/lib/tool-option-schema";
import { SOCIAL_SIZE_PRESETS, type ToolId } from "@/lib/tools";

export type LiveToolOptions = {
  aspect: string;
  onAspect: (a: string) => void;
  width: number;
  height: number;
  onWidth: (n: number) => void;
  onHeight: (n: number) => void;
  cropAspect: string;
  onCropAspect: (a: string) => void;
  upscaleScale: 2 | 4;
  onUpscaleScale: (n: 2 | 4) => void;
  bgColor: string;
  onBgColor: (c: string) => void;
  /** Phase 3 live extras */
  brushSize: number;
  onBrushSize: (n: number) => void;
  dropShadow: boolean;
  onDropShadow: (v: boolean) => void;
  subjectScale: number;
  onSubjectScale: (n: number) => void;
  position: string;
  onPosition: (v: string) => void;
  fit: string;
  onFit: (v: string) => void;
  enhanceManual: boolean;
  onEnhanceManual: (v: boolean) => void;
  brightness: number;
  onBrightness: (n: number) => void;
  contrast: number;
  onContrast: (n: number) => void;
  saturation: number;
  onSaturation: (n: number) => void;
  sharpen: number;
  onSharpen: (n: number) => void;
  warmth: number;
  onWarmth: (n: number) => void;
  exportFormat: string;
  onExportFormat: (v: string) => void;
  exportQuality: number;
  onExportQuality: (n: number) => void;
  stripMetadata: boolean;
  onStripMetadata: (v: boolean) => void;
  rotate: number;
  onRotate: (n: number) => void;
  flipH: boolean;
  onFlipH: (v: boolean) => void;
  flipV: boolean;
  onFlipV: (v: boolean) => void;
};

type Props = {
  tool: ToolId;
  live: LiveToolOptions;
  compact?: boolean;
  /** Hide export footer in compact mobile strip */
  showExport?: boolean;
};

type LocalValues = Record<string, string | number | boolean>;

function defaultsFromSections(sections: OptionSection[]): LocalValues {
  const out: LocalValues = {};
  for (const s of sections) {
    for (const c of s.controls) {
      if (c.kind === "button_row") continue;
      if (c.kind === "toggle") out[c.id] = c.defaultValue;
      else if (c.kind === "slider" || c.kind === "number") out[c.id] = c.defaultValue;
      else out[c.id] = c.defaultValue;
    }
  }
  return out;
}

function SoonBadge() {
  return (
    <span className="rounded bg-[#f0f0f3] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--muted)]">
      Soon
    </span>
  );
}

function chipClass(active: boolean) {
  return `min-h-8 rounded-lg border px-2.5 text-xs transition ${
    active
      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
      : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]/40"
  }`;
}

function isControlLive(control: ControlDef, section: OptionSection): boolean {
  const liveIds = new Set([
    "upscale_scale",
    "bg_color",
    "bg_swatches",
    "resize_aspect",
    "resize_width",
    "resize_height",
    "social_preset",
    "crop_aspect",
    "brush_size",
    "drop_shadow",
    "subject_scale",
    "subject_pos",
    "resize_fit",
    "brightness",
    "contrast",
    "saturation",
    "sharpen",
    "warmth",
    "export_format",
    "jpg_quality",
    "strip_metadata",
    "flip",
    "rotate",
    "enhance_preset",
  ]);
  if (liveIds.has(control.id)) return true;
  if (control.live === true || section.live === true) return true;
  if (control.live === false) return false;
  return false;
}

export function ToolOptionsPanel({
  tool,
  live,
  compact,
  showExport = true,
}: Props) {
  const schema = getToolOptionSchema(tool);
  const sections = useMemo(() => {
    const base = schema.sections;
    return showExport ? [...base, EXPORT_SECTION] : base;
  }, [schema, showExport]);

  const [local, setLocal] = useState<LocalValues>(() => defaultsFromSections(sections));

  useEffect(() => {
    setLocal(defaultsFromSections(getToolOptionSchema(tool).sections.concat(showExport ? [EXPORT_SECTION] : [])));
  }, [tool, showExport]);

  const setSoon = (id: string, value: string | number | boolean) => {
    setLocal((prev) => ({ ...prev, [id]: value }));
  };

  const getVal = (c: ControlDef): string | number | boolean => {
    if (c.kind === "button_row") return "";
    if (c.id === "upscale_scale") {
      if (local[c.id] === "8") return "8";
      return String(live.upscaleScale);
    }
    if (c.id === "bg_color" || c.id === "bg_swatches") return live.bgColor;
    if (c.id === "resize_aspect") return live.aspect;
    if (c.id === "resize_width") return live.width;
    if (c.id === "resize_height") return live.height;
    if (c.id === "crop_aspect") {
      const loc = local[c.id];
      if (loc === "Free" || loc === "Original") return loc;
      return live.cropAspect;
    }
    if (c.id === "social_preset") return local[c.id] ?? "";
    if (c.id === "brush_size") return live.brushSize;
    if (c.id === "drop_shadow") return live.dropShadow;
    if (c.id === "subject_scale") return live.subjectScale;
    if (c.id === "subject_pos") return live.position;
    if (c.id === "resize_fit") return live.fit;
    if (c.id === "brightness") return live.brightness;
    if (c.id === "contrast") return live.contrast;
    if (c.id === "saturation") return live.saturation;
    if (c.id === "sharpen") return live.sharpen;
    if (c.id === "warmth") return live.warmth;
    if (c.id === "export_format") return live.exportFormat;
    if (c.id === "jpg_quality") return live.exportQuality;
    if (c.id === "strip_metadata") return live.stripMetadata;
    if (c.id === "enhance_preset") return live.enhanceManual ? "manual" : "auto";
    return local[c.id] ?? ("defaultValue" in c ? c.defaultValue : "");
  };

  const onLiveOrSoon = (
    c: ControlDef,
    section: OptionSection,
    value: string | number | boolean
  ) => {
    const liveCtrl = isControlLive(c, section);

    if (liveCtrl) {
      if (c.id === "upscale_scale") {
        if (value === "2" || value === "4") {
          setSoon(c.id, value);
          live.onUpscaleScale(Number(value) as 2 | 4);
        } else {
          setSoon(c.id, value); // 8× local only
        }
        return;
      }
      if (c.id === "bg_color" || c.id === "bg_swatches") {
        live.onBgColor(String(value));
        return;
      }
      if (c.id === "resize_aspect") {
        live.onAspect(String(value));
        return;
      }
      if (c.id === "resize_width") {
        live.onWidth(Number(value));
        live.onAspect("custom");
        return;
      }
      if (c.id === "resize_height") {
        live.onHeight(Number(value));
        live.onAspect("custom");
        return;
      }
      if (c.id === "social_preset") {
        const preset = SOCIAL_SIZE_PRESETS.find((p) => p.id === value);
        if (preset) {
          live.onWidth(preset.width);
          live.onHeight(preset.height);
          if (
            preset.aspect === "custom" ||
            preset.aspect === "1.91:1" ||
            preset.id === "fb-cover" ||
            preset.id === "linkedin"
          ) {
            live.onAspect("custom");
          } else {
            live.onAspect(preset.aspect);
          }
        }
        setSoon(c.id, value);
        return;
      }
      if (c.id === "crop_aspect") {
        const v = String(value);
        if (v === "Free" || v === "Original") {
          setSoon(c.id, v);
          return;
        }
        setSoon(c.id, v);
        live.onCropAspect(v);
        return;
      }
      if (c.id === "brush_size") {
        live.onBrushSize(Number(value));
        return;
      }
      if (c.id === "drop_shadow") {
        live.onDropShadow(Boolean(value));
        return;
      }
      if (c.id === "subject_scale") {
        live.onSubjectScale(Number(value));
        return;
      }
      if (c.id === "subject_pos") {
        live.onPosition(String(value));
        return;
      }
      if (c.id === "resize_fit") {
        live.onFit(String(value));
        return;
      }
      if (c.id === "brightness") {
        live.onBrightness(Number(value));
        live.onEnhanceManual(true);
        return;
      }
      if (c.id === "contrast") {
        live.onContrast(Number(value));
        live.onEnhanceManual(true);
        return;
      }
      if (c.id === "saturation") {
        live.onSaturation(Number(value));
        live.onEnhanceManual(true);
        return;
      }
      if (c.id === "sharpen") {
        live.onSharpen(Number(value));
        live.onEnhanceManual(true);
        return;
      }
      if (c.id === "warmth") {
        live.onWarmth(Number(value));
        live.onEnhanceManual(true);
        return;
      }
      if (c.id === "export_format") {
        live.onExportFormat(String(value));
        return;
      }
      if (c.id === "jpg_quality") {
        live.onExportQuality(Number(value));
        return;
      }
      if (c.id === "strip_metadata") {
        live.onStripMetadata(Boolean(value));
        return;
      }
      if (c.id === "enhance_preset") {
        live.onEnhanceManual(String(value) !== "auto");
        setSoon(c.id, value);
        return;
      }
      if (c.id === "flip") {
        if (value === "h") live.onFlipH(!live.flipH);
        if (value === "v") live.onFlipV(!live.flipV);
        return;
      }
      if (c.id === "rotate") {
        const delta = Number(value);
        live.onRotate(((live.rotate + delta) % 360 + 360) % 360);
        return;
      }
    }

    if (c.kind === "button_row" && value === "reset") {
      const reset: LocalValues = {};
      for (const s of sections) {
        for (const ctrl of s.controls) {
          if (ctrl.kind === "button_row") continue;
          if ("defaultValue" in ctrl) reset[ctrl.id] = ctrl.defaultValue;
        }
      }
      setLocal(reset);
      return;
    }

    setSoon(c.id, value);
  };

  const renderControl = (c: ControlDef, section: OptionSection) => {
    const liveCtrl = isControlLive(c, section);
    // 8× upscale shown in live segment but behaves as soon when selected
    const showSoon =
      !liveCtrl ||
      (c.id === "upscale_scale" && String(getVal(c)) === "8") ||
      (c.id === "crop_aspect" && ["Free", "Original"].includes(String(getVal(c))));

    const wrap = (body: ReactNode) => (
      <div
        key={c.id}
        className={`space-y-1.5 ${showSoon && !liveCtrl ? "soon-option" : ""}`}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-[var(--muted)]">{c.label}</p>
          {showSoon && <SoonBadge />}
        </div>
        {body}
      </div>
    );

    if (c.kind === "segment" || c.kind === "chips") {
      const val = String(getVal(c));
      return wrap(
        <div className={`flex flex-wrap gap-1.5 ${c.kind === "segment" ? "" : ""}`}>
          {c.options.map((o) => {
            const optionSoon =
              (c.id === "upscale_scale" && o.value === "8") ||
              (c.id === "crop_aspect" && (o.value === "Free" || o.value === "Original"));
            return (
              <button
                key={o.value}
                type="button"
                className={`${chipClass(val === o.value)} ${c.kind === "segment" ? "flex-1" : ""} ${
                  optionSoon ? "opacity-80" : ""
                }`}
                onClick={() => onLiveOrSoon(c, section, o.value)}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      );
    }

    if (c.kind === "slider") {
      const val = Number(getVal(c));
      return wrap(
        <div>
          <div className="mb-1 flex justify-end text-[10px] text-[var(--muted)]">
            {val}
            {c.unit || ""}
          </div>
          <input
            type="range"
            className="w-full accent-[var(--accent)]"
            min={c.min}
            max={c.max}
            step={c.step ?? 1}
            value={val}
            onChange={(e) => onLiveOrSoon(c, section, Number(e.target.value))}
          />
        </div>
      );
    }

    if (c.kind === "toggle") {
      const val = Boolean(getVal(c));
      return wrap(
        <button
          type="button"
          role="switch"
          aria-checked={val}
          className={`relative h-7 w-12 rounded-full transition ${
            val ? "bg-[var(--accent)]" : "bg-[#d4d4d8]"
          }`}
          onClick={() => onLiveOrSoon(c, section, !val)}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
              val ? "left-5" : "left-0.5"
            }`}
          />
        </button>
      );
    }

    if (c.kind === "color") {
      return wrap(
        <input
          type="color"
          value={String(getVal(c))}
          onChange={(e) => onLiveOrSoon(c, section, e.target.value)}
          className="h-10 w-full cursor-pointer rounded-lg border border-[var(--border)]"
        />
      );
    }

    if (c.kind === "number") {
      if (
        (c.id === "resize_width" || c.id === "resize_height") &&
        live.aspect !== "custom"
      ) {
        return null;
      }
      return wrap(
        <input
          className="input"
          type="number"
          min={c.min}
          max={c.max}
          value={Number(getVal(c))}
          onChange={(e) => onLiveOrSoon(c, section, Number(e.target.value))}
        />
      );
    }

    if (c.kind === "select") {
      return wrap(
        <select
          className="input"
          value={String(getVal(c))}
          onChange={(e) => onLiveOrSoon(c, section, e.target.value)}
        >
          {c.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }

    if (c.kind === "swatches") {
      const val = String(getVal(c));
      return wrap(
        <div className="flex flex-wrap gap-1.5">
          {c.colors.map((color) => (
            <button
              key={color}
              type="button"
              title={color}
              className={`h-7 w-7 rounded-md border-2 ${
                val.toLowerCase() === color.toLowerCase()
                  ? "border-[var(--accent)]"
                  : "border-[var(--border)]"
              }`}
              style={{ background: color }}
              onClick={() => onLiveOrSoon(c, section, color)}
            />
          ))}
        </div>
      );
    }

    if (c.kind === "textarea") {
      return wrap(
        <textarea
          className="input min-h-[72px] resize-y text-sm"
          placeholder={c.placeholder}
          value={String(getVal(c))}
          onChange={(e) => onLiveOrSoon(c, section, e.target.value)}
        />
      );
    }

    if (c.kind === "button_row") {
      return wrap(
        <div className="flex flex-wrap gap-1.5">
          {c.options.map((o) => (
            <button
              key={o.value}
              type="button"
              className="btn btn-ghost min-h-9 flex-1 text-xs"
              onClick={() => onLiveOrSoon(c, section, o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <div className={`flex flex-col gap-4 ${compact ? "gap-3" : ""}`}>
      {sections.map((section) => (
        <div
          key={section.id}
          className={`space-y-3 border-t border-[var(--border)] pt-3 first:border-t-0 first:pt-0`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text)]">
              {section.title}
            </p>
            {section.id === "export" && !section.live && <SoonBadge />}
          </div>
          <div className={compact ? "space-y-2.5" : "space-y-3"}>
            {section.controls.map((c) => renderControl(c, section))}
          </div>
        </div>
      ))}
    </div>
  );
}
