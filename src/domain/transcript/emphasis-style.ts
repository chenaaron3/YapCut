import { z } from "zod";

import { DEFAULT_THEME, THEME_FONT_ROLES } from "~/domain/project/theme";
import { CAPTION_FONT_IDS } from "~/remotion/captions/style";

import type { Theme, ThemeFontRole } from "~/domain/project/theme";
import type { CaptionFontId } from "~/remotion/captions/style";

/** Default emphasis scale relative to the surrounding caption/quote group. */
export const DEFAULT_EMPHASIS_SCALE = 1.25;

/** Default emphasis fill when style leaves fill unset (matches Theme.colors.accent). */
export const DEFAULT_EMPHASIS_FILL = DEFAULT_THEME.colors.accent;

/** Clamp range for emphasis scale (× group fontSize). */
export const EMPHASIS_SCALE_MIN = 0.5;
export const EMPHASIS_SCALE_MAX = 2.5;

/**
 * Theme roles cycled for quote emphasis when `cycleFontRoles` is on.
 * Skips `punch` — that is the default body face.
 */
export const EMPHASIS_CYCLE_FONT_ROLES: readonly ThemeFontRole[] =
  THEME_FONT_ROLES.filter((role) => role !== "punch");

/**
 * Emphasis treatment layered on the current caption/quote group style.
 * Sparse — missing keys resolve at props time.
 * Same shape for ProjectConfig and VfxQuoteEdit; quote keys merge over project.
 * Not a TemplateStyle: no y / words-per-group. Scribble is a word field, not here.
 */
export type EmphasisStyle = {
  scale?: number;
  fill?: string;
  fontFamily?: CaptionFontId;
  /**
   * Quote-only: cycle theme font roles across emphasized words.
   * Start role is hash-seeded from the quote id; `fontFamily` is ignored.
   */
  cycleFontRoles?: boolean;
};

/**
 * Fully resolved emphasis paint for a caption group.
 * Unset font → Theme handwritten face.
 */
export type ResolvedEmphasisStyle = {
  scale: number;
  fill: string;
  fontFamily: CaptionFontId;
};

export function clampEmphasisScale(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_EMPHASIS_SCALE;
  return Math.min(EMPHASIS_SCALE_MAX, Math.max(EMPHASIS_SCALE_MIN, n));
}

/**
 * Merge quote emphasis over project and materialize defaults.
 * Project is always present; quote keys override when set.
 * Unset font uses Theme.fonts.handwritten.
 */
export function pickEmphasisStyle(
  project: EmphasisStyle,
  quote?: EmphasisStyle | null,
  theme: Theme = DEFAULT_THEME,
): ResolvedEmphasisStyle {
  const s = { ...project, ...quote };
  return {
    scale: clampEmphasisScale(s.scale ?? DEFAULT_EMPHASIS_SCALE),
    fill: s.fill?.trim() ? s.fill.trim() : theme.colors.accent,
    fontFamily: s.fontFamily ?? theme.fonts.handwritten,
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
  if ("cycleFontRoles" in partial) {
    if (partial.cycleFontRoles) {
      next.cycleFontRoles = true;
      delete next.fontFamily;
    } else {
      delete next.cycleFontRoles;
    }
  }
  return next;
}

/** Stable 32-bit mix so the same quote id always starts on the same role. */
export function hashQuoteFontSeed(quoteId: number): number {
  let h = quoteId | 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Theme face for the n-th emphasized word in a quote with `cycleFontRoles`.
 * Start index = hash(quoteId) % role count; then punch → script → handwritten.
 */
export function emphasisFontForCycledWord(
  quoteId: number,
  emphasizedIndex: number,
  theme: Theme = DEFAULT_THEME,
): CaptionFontId {
  const roles = EMPHASIS_CYCLE_FONT_ROLES;
  const start = hashQuoteFontSeed(quoteId) % roles.length;
  const role = roles[(start + emphasizedIndex) % roles.length]!;
  return theme.fonts[role];
}

/**
 * Stateful allocator for quote `cycleFontRoles`.
 * Call `next` once per displayed emphasized word, in timeline order.
 */
export function createQuoteEmphasisFontCycler(theme: Theme = DEFAULT_THEME) {
  const indexByQuote = new Map<number, number>();
  return (quoteId: number): CaptionFontId => {
    const idx = indexByQuote.get(quoteId) ?? 0;
    indexByQuote.set(quoteId, idx + 1);
    return emphasisFontForCycledWord(quoteId, idx, theme);
  };
}

const captionFontEnum = z.enum(
  CAPTION_FONT_IDS as unknown as [CaptionFontId, ...CaptionFontId[]],
);

const emphasisStyleObjectSchema = z.object({
  scale: z.number().optional(),
  fill: z.string().optional(),
  fontFamily: captionFontEnum.optional(),
  cycleFontRoles: z.boolean().optional(),
});

export const emphasisStyleSchema = emphasisStyleObjectSchema.default({
  scale: DEFAULT_EMPHASIS_SCALE,
});

/** Optional quote override — same shape as project; omit = use project. */
export const optionalEmphasisStyleSchema = emphasisStyleObjectSchema.optional();
