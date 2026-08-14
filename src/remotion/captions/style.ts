/** Curated caption font IDs — weight is baked into each entry. */
export const CAPTION_FONT_IDS = [
  "clash-display",
  "satoshi",
  "tanker",
  "comico",
  "dancing-script",
  "chillax",
] as const;
export type CaptionFontId = (typeof CAPTION_FONT_IDS)[number];

export function isCaptionFontId(value: unknown): value is CaptionFontId {
  return (
    typeof value === "string" &&
    (CAPTION_FONT_IDS as readonly string[]).includes(value)
  );
}

export type CaptionFontFace = {
  id: CaptionFontId;
  /** CSS font-family stack. */
  family: string;
  weight: number;
};

export const CAPTION_FONTS: Record<CaptionFontId, CaptionFontFace> = {
  "clash-display": {
    id: "clash-display",
    family: '"Clash Display", Impact, "Arial Black", sans-serif',
    weight: 700,
  },
  satoshi: {
    id: "satoshi",
    family: '"Satoshi", "Helvetica Neue", Helvetica, Arial, sans-serif',
    weight: 900,
  },
  tanker: {
    id: "tanker",
    family: '"Tanker", Impact, "Arial Narrow", sans-serif',
    weight: 400,
  },
  comico: {
    id: "comico",
    family: '"Comico", "Segoe Script", cursive',
    weight: 400,
  },
  "dancing-script": {
    id: "dancing-script",
    family: '"Dancing Script", "Segoe Script", cursive',
    weight: 700,
  },
  chillax: {
    id: "chillax",
    family: '"Chillax", "Helvetica Neue", Helvetica, Arial, sans-serif',
    weight: 700,
  },
};

export const CAPTION_FONT_LABELS: Record<CaptionFontId, string> = {
  "clash-display": "Clash Display",
  satoshi: "Satoshi",
  tanker: "Tanker",
  comico: "Comico",
  "dancing-script": "Dancing Script",
  chillax: "Chillax",
};

/** Group wrappers: fade/scale/slide/bounce/spin → EnterExit; wipe → Wipe. */
export const CAPTION_GROUP_ANIMATIONS = [
  "none",
  "fade",
  "scale",
  "slide",
  "wipe",
  "bounce",
  "spin",
] as const;
export type CaptionGroupAnimation = (typeof CAPTION_GROUP_ANIMATIONS)[number];

export function isCaptionGroupAnimation(
  value: unknown,
): value is CaptionGroupAnimation {
  return (
    typeof value === "string" &&
    (CAPTION_GROUP_ANIMATIONS as readonly string[]).includes(value)
  );
}

/** Word wrappers (subset of group). Arc posing forces these to none. */
export const CAPTION_WORD_ANIMATIONS = [
  "none",
  "fade",
  "wipe",
  "scale",
  "slide",
  "bounce",
] as const;
export type CaptionWordAnimation = (typeof CAPTION_WORD_ANIMATIONS)[number];

export function isCaptionWordAnimation(
  value: unknown,
): value is CaptionWordAnimation {
  return (
    typeof value === "string" &&
    (CAPTION_WORD_ANIMATIONS as readonly string[]).includes(value)
  );
}

/** Glyph reveal inside CaptionWordSpan. Not an AnimationMount entry. */
export const CAPTION_WORD_REVEALS = ["none", "typewriter"] as const;
export type CaptionWordReveal = (typeof CAPTION_WORD_REVEALS)[number];

export function isCaptionWordReveal(
  value: unknown,
): value is CaptionWordReveal {
  return (
    typeof value === "string" &&
    (CAPTION_WORD_REVEALS as readonly string[]).includes(value)
  );
}

export const CAPTION_TEXT_TRANSFORMS = [
  "none",
  "uppercase",
  "lowercase",
  "capitalize",
] as const;
export type CaptionTextTransform = (typeof CAPTION_TEXT_TRANSFORMS)[number];

export function isCaptionTextTransform(
  value: unknown,
): value is CaptionTextTransform {
  return (
    typeof value === "string" &&
    (CAPTION_TEXT_TRANSFORMS as readonly string[]).includes(value)
  );
}

export const BACKGROUND_KINDS = [
  "none",
  "box",
  "wrap",
  "rounded",
  "scrap",
  "ribbon",
  "underline",
] as const;
export type BackgroundKind = (typeof BACKGROUND_KINDS)[number];

export function isBackgroundKind(value: unknown): value is BackgroundKind {
  return (
    typeof value === "string" &&
    (BACKGROUND_KINDS as readonly string[]).includes(value)
  );
}

/** Shared background chrome for group or word. */
export type BackgroundStyle = {
  kind: BackgroundKind;
  /** Ignored when kind is `none`. */
  color?: string | null;
};

export const CAPTION_FONT_STYLES = ["normal", "italic"] as const;
export type CaptionFontStyle = (typeof CAPTION_FONT_STYLES)[number];

export function isCaptionFontStyle(value: unknown): value is CaptionFontStyle {
  return (
    typeof value === "string" &&
    (CAPTION_FONT_STYLES as readonly string[]).includes(value)
  );
}

export const CAPTION_TEXT_ALIGNS = ["left", "center", "right"] as const;
export type CaptionTextAlign = (typeof CAPTION_TEXT_ALIGNS)[number];

export function isCaptionTextAlign(value: unknown): value is CaptionTextAlign {
  return (
    typeof value === "string" &&
    (CAPTION_TEXT_ALIGNS as readonly string[]).includes(value)
  );
}

export type WordBorder = {
  width: number;
  color: string;
};

/** Paint props for a single word (base or resolved state). */
export type WordStyle = {
  fill: string;
  border?: WordBorder | null;
  background?: BackgroundStyle | null;
  /** Default 1 when omitted. */
  opacity?: number;
  /** CSS text-shadow; null/omit = none. */
  textShadow?: string | null;
};

export type WordStyleDelta = Partial<WordStyle>;

/**
 * Shared caption look for episode defaults, Quote templates, and text VFX.
 * `groupAnimation` / `wordAnimation` go through AnimationMount.
 * `wordReveal` paints in CaptionWordSpan. Arc is glyph layout, not motion.
 */
export type CaptionGroupStyle = {
  fontFamily: CaptionFontId;
  fontSize: number;
  /**
   * Captions/quotes: −1…1 in the safe area (world placement).
   * Overlay lines after the first: localY as a fraction of the previous
   * group's AABB height (0 = flush, negative = into the hollow).
   */
  y: number;
  groupAnimation: CaptionGroupAnimation;
  wordAnimation: CaptionWordAnimation;
  wordReveal: CaptionWordReveal;
  textTransform: CaptionTextTransform;
  captionsAtATime: number;
  background: BackgroundStyle;
  fontStyle: CaptionFontStyle;
  textAlign: CaptionTextAlign;
  /** Base word look — required. Past words use this as-is. */
  wordStyle: WordStyle;
  /** Optional deltas merged onto `wordStyle` for active/future words. */
  activeWordStyle?: WordStyleDelta;
  futureWordStyle?: WordStyleDelta;
  /**
   * Glyph curve on the text only. 0/omit = flat.
   * |arc| 100 = semicircle. Positive = rainbow; negative = frown.
   */
  arc?: number;
};

/** User-editable overrides persisted with a templateId. */
export type CaptionStyleOverrides = {
  y?: number;
  fontSize?: number;
  fontFamily?: CaptionFontId;
  captionsAtATime?: number;
  /** Patches `wordStyle.fill`. */
  fill?: string;
  /** Patches `arc`. */
  arc?: number;
};

/** Fallback caption look when a group omits style. */
export const DEFAULT_CAPTION_STYLE: CaptionGroupStyle = {
  fontFamily: "chillax",
  fontSize: 40,
  y: 1,
  groupAnimation: "none",
  wordAnimation: "none",
  wordReveal: "none",
  textTransform: "lowercase",
  captionsAtATime: 5,
  background: { kind: "none" },
  fontStyle: "normal",
  textAlign: "center",
  wordStyle: {
    fill: "#FFFFFF",
    border: { width: 4, color: "#000000" },
    opacity: 1,
  },
  activeWordStyle: {
    border: { width: 10, color: "#000000" },
  },
  futureWordStyle: { opacity: 0 },
};

/** Shared Y for aesthetic Quote templates — near the top of the safe area. */
export const QUOTE_CAPTION_Y = -0.84;

/** Bottom of safe area — default / caption templates. */
export const TRENDING_CAPTION_Y = 1;

/** Default enter/exit window used for short-duration hard-skip. */
export const CAPTION_ENTER_SEC = 0.18;

/** Word-state blend duration (future → active → past). */
export const WORD_STATE_BLEND_SEC = 0.08;

/** Group-scope typewriter delay between characters. */
export const TYPEWRITER_CHAR_DELAY_SEC = 0.02;

export function resolveCaptionFont(id: CaptionFontId): CaptionFontFace {
  return CAPTION_FONTS[id];
}

export function clampCaptionY(y: number): number {
  if (!Number.isFinite(y)) return DEFAULT_CAPTION_STYLE.y;
  return Math.min(1, Math.max(-1, y));
}

/** Safe-area t for captions/quotes: y −1…1 → 0…1 (0 = top of safe area). */
export function captionSafeAreaT(y: number): number {
  return 0.5 + 0.5 * clampCaptionY(y);
}

export function clampCaptionsAtATime(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_CAPTION_STYLE.captionsAtATime;
  return Math.min(8, Math.max(1, Math.round(n)));
}

export const CAPTION_ARC_MIN = -100;
export const CAPTION_ARC_MAX = 100;

export function clampCaptionArc(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(CAPTION_ARC_MAX, Math.max(CAPTION_ARC_MIN, Math.round(n)));
}

/** Resolved glyph-curve amount; 0 means flat. */
export function captionArc(style: CaptionGroupStyle): number {
  return clampCaptionArc(style.arc ?? 0);
}

/** Word wrappers. Glyph posing cannot sit inside EnterExit/Wipe. */
export function captionWordAnimation(
  style: CaptionGroupStyle,
): CaptionWordAnimation {
  return captionArc(style) !== 0 ? "none" : style.wordAnimation;
}

export function mergeWordStyle(
  base: WordStyle,
  delta?: WordStyleDelta | null,
): WordStyle {
  if (!delta) return { ...base };
  return {
    fill: delta.fill ?? base.fill,
    border: "border" in delta ? delta.border : base.border,
    background: "background" in delta ? delta.background : base.background,
    opacity: delta.opacity ?? base.opacity,
    textShadow: "textShadow" in delta ? delta.textShadow : base.textShadow,
  };
}

/** Apply persisted overrides onto a resolved template style. */
export function applyCaptionOverrides(
  style: CaptionGroupStyle,
  overrides?: CaptionStyleOverrides | null,
): CaptionGroupStyle {
  if (!overrides) return style;
  return {
    ...style,
    y: overrides.y != null ? clampCaptionY(overrides.y) : style.y,
    fontSize:
      overrides.fontSize != null &&
      Number.isFinite(overrides.fontSize) &&
      overrides.fontSize > 0
        ? overrides.fontSize
        : style.fontSize,
    fontFamily: overrides.fontFamily ?? style.fontFamily,
    captionsAtATime:
      overrides.captionsAtATime != null
        ? clampCaptionsAtATime(overrides.captionsAtATime)
        : style.captionsAtATime,
    arc: overrides.arc != null ? clampCaptionArc(overrides.arc) : style.arc,
    wordStyle: {
      ...style.wordStyle,
      fill: overrides.fill?.trim()
        ? overrides.fill.trim()
        : style.wordStyle.fill,
    },
  };
}

/** Extract editable overrides from a full style (vs template defaults). */
export function captionStyleOverridesFrom(
  style: CaptionGroupStyle,
  template: CaptionGroupStyle,
): CaptionStyleOverrides {
  const out: CaptionStyleOverrides = {};
  if (style.y !== template.y) out.y = style.y;
  if (style.fontSize !== template.fontSize) out.fontSize = style.fontSize;
  if (style.fontFamily !== template.fontFamily) out.fontFamily = style.fontFamily;
  if (style.captionsAtATime !== template.captionsAtATime) {
    out.captionsAtATime = style.captionsAtATime;
  }
  if (captionArc(style) !== captionArc(template)) {
    out.arc = captionArc(style);
  }
  if (style.wordStyle.fill !== template.wordStyle.fill) {
    out.fill = style.wordStyle.fill;
  }
  return out;
}
