import { z } from "zod";

import {
  CAPTION_FONT_IDS,
  type CaptionFontId,
} from "~/remotion/captions/style";

/** Default emphasis scale relative to the surrounding caption/quote group. */
export const DEFAULT_EMPHASIS_SCALE = 1.15;

/** Default emphasis fill when style leaves fill unset. */
export const DEFAULT_EMPHASIS_FILL = "#FFE600";

/** Clamp range for emphasis scale (× group fontSize). */
export const EMPHASIS_SCALE_MIN = 0.5;
export const EMPHASIS_SCALE_MAX = 2.5;

/**
 * Emphasis treatment layered on the current caption/quote group style.
 * Sparse — missing keys resolve at props time.
 * Same shape for ProjectConfig and VfxQuoteEdit; quote keys merge over project.
 * Not a TemplateStyle: no y / words-per-group.
 */
export type EmphasisStyle = {
  scale?: number;
  fill?: string;
  fontFamily?: CaptionFontId;
};

/**
 * Fully resolved emphasis paint for a caption group.
 * `fontFamily` null = keep the surrounding group font.
 */
export type ResolvedEmphasisStyle = {
  scale: number;
  fill: string;
  fontFamily: CaptionFontId | null;
};

export function clampEmphasisScale(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_EMPHASIS_SCALE;
  return Math.min(EMPHASIS_SCALE_MAX, Math.max(EMPHASIS_SCALE_MIN, n));
}

/**
 * Merge quote emphasis over project and materialize defaults.
 * Project is always present; quote keys override when set.
 */
export function pickEmphasisStyle(
  project: EmphasisStyle,
  quote?: EmphasisStyle | null,
): ResolvedEmphasisStyle {
  const s = { ...project, ...quote };
  return {
    scale: clampEmphasisScale(s.scale ?? DEFAULT_EMPHASIS_SCALE),
    fill: s.fill?.trim() ? s.fill.trim() : DEFAULT_EMPHASIS_FILL,
    fontFamily: s.fontFamily ?? null,
  };
}

/** Apply a sparse patch; `undefined` values omit that key from the result. */
export function applyEmphasisPatch(
  base: EmphasisStyle,
  partial: EmphasisStyle,
): EmphasisStyle {
  const next: EmphasisStyle = { ...base };
  if ("scale" in partial) {
    if (partial.scale === undefined) delete next.scale;
    else next.scale = partial.scale;
  }
  if ("fill" in partial) {
    if (partial.fill === undefined) delete next.fill;
    else next.fill = partial.fill;
  }
  if ("fontFamily" in partial) {
    if (partial.fontFamily === undefined) delete next.fontFamily;
    else next.fontFamily = partial.fontFamily;
  }
  return next;
}

const captionFontEnum = z.enum(
  CAPTION_FONT_IDS as unknown as [CaptionFontId, ...CaptionFontId[]],
);

const emphasisStyleObjectSchema = z.object({
  scale: z.number().optional(),
  fill: z.string().optional(),
  fontFamily: captionFontEnum.optional(),
});

export const emphasisStyleSchema = emphasisStyleObjectSchema.default({});

/** Optional quote override — same shape as project; omit = use project. */
export const optionalEmphasisStyleSchema = emphasisStyleObjectSchema.optional();
