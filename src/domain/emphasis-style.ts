import { z } from "zod";

import {
  CAPTION_FONT_IDS,
  isCaptionFontId,
  type CaptionFontId,
} from "~/remotion/captions/style";

/** Default emphasis scale relative to the surrounding caption/quote group. */
export const DEFAULT_EMPHASIS_SCALE = 1.15;

/** Default emphasis fill when project/quote leave fill unset. */
export const DEFAULT_EMPHASIS_FILL = "#FFE600";

/** Clamp range for emphasis scale (× group fontSize). */
export const EMPHASIS_SCALE_MIN = 0.5;
export const EMPHASIS_SCALE_MAX = 2.5;

/**
 * Project-level emphasis look. Sparse — missing keys resolve at props time.
 * Not a TemplateStyle: no y / words-per-group (those stay on the surrounding group).
 */
export type EmphasisStyle = {
  scale?: number;
  fill?: string;
  fontFamily?: CaptionFontId;
};

/**
 * Quote override on top of project emphasis.
 * `fill` / `fontFamily` may be `null` = inherit surrounding group (block project).
 * Omit = fall through to project → defaults.
 */
export type QuoteEmphasisStyle = {
  scale?: number;
  fill?: string | null;
  fontFamily?: CaptionFontId | null;
};

/**
 * Fully resolved emphasis paint for a caption group.
 * `fill` / `fontFamily` null = do not override the group word paint / font.
 */
export type ResolvedEmphasisStyle = {
  scale: number;
  fill: string | null;
  fontFamily: CaptionFontId | null;
};

export function clampEmphasisScale(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_EMPHASIS_SCALE;
  return Math.min(EMPHASIS_SCALE_MAX, Math.max(EMPHASIS_SCALE_MIN, n));
}

function asTrimmedFill(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Normalize a persisted project emphasis object (drop invalid keys). */
export function normalizeEmphasisStyle(value: unknown): EmphasisStyle {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const src = value as Record<string, unknown>;
  const out: EmphasisStyle = {};
  if ("scale" in src && src.scale != null) {
    const n = Number(src.scale);
    if (Number.isFinite(n)) out.scale = clampEmphasisScale(n);
  }
  if ("fill" in src) {
    const fill = asTrimmedFill(src.fill);
    if (fill) out.fill = fill;
  }
  if ("fontFamily" in src && isCaptionFontId(src.fontFamily)) {
    out.fontFamily = src.fontFamily;
  }
  return out;
}

/**
 * Normalize a quote emphasis override.
 * Preserves explicit `null` sentinels for fill / fontFamily.
 */
export function normalizeQuoteEmphasisStyle(
  value: unknown,
): QuoteEmphasisStyle {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const src = value as Record<string, unknown>;
  const out: QuoteEmphasisStyle = {};
  if ("scale" in src && src.scale != null) {
    const n = Number(src.scale);
    if (Number.isFinite(n)) out.scale = clampEmphasisScale(n);
  }
  if ("fill" in src) {
    if (src.fill === null) out.fill = null;
    else {
      const fill = asTrimmedFill(src.fill);
      if (fill) out.fill = fill;
    }
  }
  if ("fontFamily" in src) {
    if (src.fontFamily === null) out.fontFamily = null;
    else if (isCaptionFontId(src.fontFamily)) {
      out.fontFamily = src.fontFamily;
    }
  }
  return out;
}

/** Merge quote override over project base into concrete paint knobs. */
export function resolveEmphasisStyle(
  project: EmphasisStyle | null | undefined,
  quote?: QuoteEmphasisStyle | null,
): ResolvedEmphasisStyle {
  const base = project ?? {};
  const over = quote ?? {};

  const scale = clampEmphasisScale(
    over.scale ?? base.scale ?? DEFAULT_EMPHASIS_SCALE,
  );

  let fill: string | null;
  if ("fill" in over) {
    fill = over.fill ?? null;
  } else if (base.fill != null && base.fill.trim()) {
    fill = base.fill.trim();
  } else {
    fill = DEFAULT_EMPHASIS_FILL;
  }

  let fontFamily: CaptionFontId | null;
  if ("fontFamily" in over) {
    fontFamily = over.fontFamily ?? null;
  } else if (base.fontFamily != null && isCaptionFontId(base.fontFamily)) {
    fontFamily = base.fontFamily;
  } else {
    fontFamily = null;
  }

  return { scale, fill, fontFamily };
}

const captionFontEnum = z.enum(
  CAPTION_FONT_IDS as unknown as [CaptionFontId, ...CaptionFontId[]],
);

export const emphasisStyleSchema = z
  .object({
    scale: z.number().optional(),
    fill: z.string().optional(),
    fontFamily: captionFontEnum.optional(),
  })
  .default({});

export const quoteEmphasisStyleSchema = z
  .object({
    scale: z.number().optional(),
    fill: z.string().nullable().optional(),
    fontFamily: captionFontEnum.nullable().optional(),
  })
  .optional();
