import { normalizeCaptionOverrides } from "~/remotion/captions/parse-style";
import {
  applyCaptionOverrides,
  QUOTE_CAPTION_Y,
  type CaptionGroupStyle,
} from "~/remotion/captions/style";

export const TEXT_TEMPLATE_IDS = [
  "simple-white",
  "simple-black",
  "white-board",
  "arc-ribbon",
] as const;

export type TextTemplateId = (typeof TEXT_TEMPLATE_IDS)[number];

export function isTextTemplateId(value: unknown): value is TextTemplateId {
  return (
    typeof value === "string" &&
    (TEXT_TEMPLATE_IDS as readonly string[]).includes(value)
  );
}

export type TextTemplate = {
  id: TextTemplateId;
  label: string;
  style: CaptionGroupStyle;
  /** Second-line look when the edit has a subheading. */
  subheadingStyle?: CaptionGroupStyle;
};

/** Default on-screen text VFX — white board title. */
export const DEFAULT_TEXT_STYLE: CaptionGroupStyle = {
  fontFamily: "proxima-nova",
  fontSize: 75,
  y: QUOTE_CAPTION_Y,
  animation: "fade",
  textTransform: "none",
  captionsAtATime: 1,
  background: { kind: "wrap", color: "#FFFFFF" },
  fontStyle: "normal",
  textAlign: "center",
  wordStyle: {
    fill: "#111111",
    opacity: 1,
  },
};

export const DEFAULT_TEXT_TEMPLATE_ID: TextTemplateId = "white-board";

function defaultSubheadingStyle(heading: CaptionGroupStyle): CaptionGroupStyle {
  return {
    ...heading,
    fontSize: Math.max(24, Math.round(heading.fontSize * 0.55)),
    animation: "fade",
    arc: 0,
    background: { kind: "none" },
    wordStyle: {
      ...heading.wordStyle,
      border: null,
    },
  };
}

export const TEXT_TEMPLATES: Record<TextTemplateId, TextTemplate> = {
  "simple-white": {
    id: "simple-white",
    label: "Simple White",
    style: {
      fontFamily: "proxima-nova",
      fontSize: 75,
      y: QUOTE_CAPTION_Y,
      animation: "fade",
      textTransform: "capitalize",
      captionsAtATime: 1,
      background: { kind: "none" },
      fontStyle: "normal",
      textAlign: "center",
      wordStyle: {
        fill: "#FFFFFF",
        opacity: 1,
      },
    },
  },
  "simple-black": {
    id: "simple-black",
    label: "Simple Black",
    style: {
      fontFamily: "proxima-nova",
      fontSize: 75,
      y: QUOTE_CAPTION_Y,
      animation: "fade",
      textTransform: "none",
      captionsAtATime: 1,
      background: { kind: "none" },
      fontStyle: "normal",
      textAlign: "center",
      wordStyle: {
        fill: "#111111",
        opacity: 1,
      },
    },
  },
  "white-board": {
    id: "white-board",
    label: "White Board",
    style: { ...DEFAULT_TEXT_STYLE },
  },
  "arc-ribbon": {
    id: "arc-ribbon",
    label: "Arc + Ribbon",
    style: {
      fontFamily: "great-vibes",
      fontSize: 76,
      y: QUOTE_CAPTION_Y,
      animation: "typewriter",
      textTransform: "none",
      captionsAtATime: 1,
      background: { kind: "none" },
      fontStyle: "normal",
      textAlign: "center",
      arc: 90,
      wordStyle: {
        fill: "#FFFFFF",
        opacity: 1,
        border: { width: 3, color: "#000000" },
      },
    },
    subheadingStyle: {
      fontFamily: "inter",
      fontSize: 48,
      y: QUOTE_CAPTION_Y,
      animation: "fade",
      textTransform: "lowercase",
      captionsAtATime: 1,
      background: { kind: "ribbon", color: "#FFFFFF" },
      fontStyle: "normal",
      textAlign: "center",
      wordStyle: { fill: "#111111", opacity: 1 },
    },
  },
};

export const TEXT_TEMPLATE_LIST: TextTemplate[] = TEXT_TEMPLATE_IDS.map(
  (id) => TEXT_TEMPLATES[id],
);

export function resolveTextTemplate(templateId: TextTemplateId): TextTemplate {
  return TEXT_TEMPLATES[templateId] ?? TEXT_TEMPLATES[DEFAULT_TEXT_TEMPLATE_ID];
}

export function resolveTextTemplateStyle(
  templateId: TextTemplateId,
): CaptionGroupStyle {
  return resolveTextTemplate(templateId).style;
}

/** Heading + subheading looks. Size/fill/arc overrides apply to the heading. */
export function resolveTextLayerStyles(
  templateId: string,
  overrides?: Record<string, unknown>,
): { heading: CaptionGroupStyle; subheading: CaptionGroupStyle } {
  const tid = isTextTemplateId(templateId)
    ? templateId
    : DEFAULT_TEXT_TEMPLATE_ID;
  const template = resolveTextTemplate(tid);
  const normalized = normalizeCaptionOverrides(overrides);
  const heading = applyCaptionOverrides(template.style, normalized);
  const subBase =
    template.subheadingStyle ?? defaultSubheadingStyle(template.style);
  return {
    heading,
    subheading: applyCaptionOverrides(subBase, {
      y: normalized.y,
    }),
  };
}
