/** Curated caption font IDs — weight is baked into each entry. */
export const CAPTION_FONT_IDS = [
  "montserrat",
  "pacifico",
  "nunito",
  "inter",
  "proxima-nova",
  "poppins",
  "caveat",
  "baloo-2",
  "oswald",
  "playfair-display",
  "anton",
  "homemade-apple",
  "pinyon-script",
  "poiret-one",
  "great-vibes",
  "black-ops-one",
  "bootzy-tm",
  "scholar-it",
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
  montserrat: {
    id: "montserrat",
    family: '"Montserrat", "Arial Black", Impact, sans-serif',
    weight: 900,
  },
  pacifico: {
    id: "pacifico",
    family: '"Pacifico", "Segoe Script", cursive',
    weight: 400,
  },
  nunito: {
    id: "nunito",
    family: '"Nunito", "Arial Rounded MT Bold", sans-serif',
    weight: 800,
  },
  inter: {
    id: "inter",
    family: '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif',
    weight: 700,
  },
  "proxima-nova": {
    id: "proxima-nova",
    family:
      '"Proxima Nova", "Proxima Nova Semibold", "Helvetica Neue", Helvetica, Arial, sans-serif',
    weight: 600,
  },
  poppins: {
    id: "poppins",
    family: '"Poppins", "Helvetica Neue", Helvetica, Arial, sans-serif',
    weight: 700,
  },
  caveat: {
    id: "caveat",
    family: '"Caveat", "Segoe Script", cursive',
    weight: 700,
  },
  "baloo-2": {
    id: "baloo-2",
    family: '"Baloo 2", "Arial Rounded MT Bold", sans-serif',
    weight: 800,
  },
  oswald: {
    id: "oswald",
    family: '"Oswald", "Arial Narrow", Impact, sans-serif',
    weight: 700,
  },
  "playfair-display": {
    id: "playfair-display",
    family: '"Playfair Display", Georgia, "Times New Roman", serif',
    weight: 700,
  },
  anton: {
    id: "anton",
    family: '"Anton", Impact, "Arial Black", sans-serif',
    weight: 400,
  },
  "homemade-apple": {
    id: "homemade-apple",
    family: '"Homemade Apple", "Segoe Script", cursive',
    weight: 400,
  },
  "pinyon-script": {
    id: "pinyon-script",
    family: '"Pinyon Script", "Segoe Script", cursive',
    weight: 400,
  },
  "poiret-one": {
    id: "poiret-one",
    family: '"Poiret One", "Helvetica Neue", Helvetica, Arial, sans-serif',
    weight: 400,
  },
  "great-vibes": {
    id: "great-vibes",
    family: '"Great Vibes", "Segoe Script", cursive',
    weight: 400,
  },
  "black-ops-one": {
    id: "black-ops-one",
    family: '"Black Ops One", Impact, "Arial Black", sans-serif',
    weight: 400,
  },
  "bootzy-tm": {
    id: "bootzy-tm",
    family: '"Bootzy TM", "BootzyTM", Impact, "Arial Black", sans-serif',
    weight: 400,
  },
  "scholar-it": {
    id: "scholar-it",
    family: '"Scholar Italic", "Scholar-Italic", Georgia, "Times New Roman", serif',
    weight: 400,
  },
};

/** Enter/exit motion applied to words (caption/quote) or the whole group (text). */
export const CAPTION_ANIMATIONS = [
  "none",
  "fade",
  "scale",
  "slide",
  "typewriter",
] as const;
export type CaptionAnimation = (typeof CAPTION_ANIMATIONS)[number];

export function isCaptionAnimation(value: unknown): value is CaptionAnimation {
  return (
    typeof value === "string" &&
    (CAPTION_ANIMATIONS as readonly string[]).includes(value)
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
 * Animation target (per-word vs whole group) is chosen by the parent view
 * ({@link DynamicGroupView} vs {@link StaticGroupView}), not this type.
 */
export type CaptionGroupStyle = {
  fontFamily: CaptionFontId;
  fontSize: number;
  /**
   * Captions/quotes: −1…1 in the safe area (0 = middle, 1 = bottom, −1 = top).
   * Overlay heading/subheading: translate of that line's own height (±1 = ±100%).
   */
  y: number;
  animation: CaptionAnimation;
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
   * StaticGroupView curve (CapCut-style). 0/omit = flat.
   * Positive = rainbow (up in the middle); negative = frown. −100…100.
   */
  arc?: number;
};

/** User-editable overrides persisted with a templateId. */
export type CaptionStyleOverrides = {
  y?: number;
  fontSize?: number;
  captionsAtATime?: number;
  /** Patches `wordStyle.fill`. */
  fill?: string;
  /** Patches `arc` (StaticGroupView). */
  arc?: number;
};

/** Fallback caption look when a group omits style. */
export const DEFAULT_CAPTION_STYLE: CaptionGroupStyle = {
  fontFamily: "inter",
  fontSize: 40,
  y: 1,
  animation: "none",
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

/** Resolved curve amount; 0 means flat (flex row). */
export function captionArc(style: CaptionGroupStyle): number {
  return clampCaptionArc(style.arc ?? 0);
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
