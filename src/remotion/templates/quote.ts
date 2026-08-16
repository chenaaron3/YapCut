import { QUOTE_CAPTION_Y } from "~/remotion/captions/style";

import type { CaptionGroupStyle } from "~/remotion/captions/style";

export const QUOTE_TEMPLATE_IDS = ["bold-white", "typewriter", "pop"] as const;

export type QuoteTemplateId = (typeof QUOTE_TEMPLATE_IDS)[number];

export function isQuoteTemplateId(value: unknown): value is QuoteTemplateId {
  return (
    typeof value === "string" &&
    (QUOTE_TEMPLATE_IDS as readonly string[]).includes(value)
  );
}

export type QuoteTemplate = {
  id: QuoteTemplateId;
  label: string;
  style: CaptionGroupStyle;
};

export const DEFAULT_QUOTE_TEMPLATE_ID: QuoteTemplateId = "bold-white";

const QUOTE_TEXT_SHADOW = "0 2px 0 #000, 0 4px 14px rgba(0,0,0,0.8)";

const QUOTE_WHITE_WORD = {
  fill: "#FFFFFF",
  opacity: 1,
  border: { width: 6, color: "#000000" },
  textShadow: QUOTE_TEXT_SHADOW,
} as const;

const QUOTE_TYPEWRITER_WORD = {
  fill: "#FFFFFF",
  opacity: 1,
  border: { width: 5, color: "#000000" },
  textShadow: QUOTE_TEXT_SHADOW,
} as const;

const BOLD_WHITE_BASE: CaptionGroupStyle = {
  fontFamily: "chillax",
  fontSize: 125,
  y: 0,
  groupAnimation: "none",
  wordAnimation: "fade",
  wordReveal: "none",
  textTransform: "uppercase",
  captionsAtATime: 1,
  background: { kind: "none" },
  fontStyle: "normal",
  textAlign: "center",
  wordStyle: { ...QUOTE_WHITE_WORD },
};

export const QUOTE_TEMPLATES: Record<QuoteTemplateId, QuoteTemplate> = {
  "bold-white": {
    id: "bold-white",
    label: "Bold White",
    style: { ...BOLD_WHITE_BASE },
  },
  typewriter: {
    id: "typewriter",
    label: "Typewriter",
    style: {
      fontFamily: "comico",
      fontSize: 72,
      y: QUOTE_CAPTION_Y,
      groupAnimation: "none",
      wordAnimation: "none",
      wordReveal: "typewriter",
      textTransform: "lowercase",
      captionsAtATime: 3,
      background: { kind: "none" },
      fontStyle: "normal",
      textAlign: "center",
      wordStyle: { ...QUOTE_TYPEWRITER_WORD },
      futureWordStyle: { opacity: 0 },
    },
  },
  pop: {
    id: "pop",
    label: "Pop",
    style: {
      fontFamily: "clash-display",
      fontSize: 88,
      y: 0,
      groupAnimation: "none",
      wordAnimation: "scale",
      wordReveal: "none",
      textTransform: "uppercase",
      captionsAtATime: 1,
      background: { kind: "none" },
      fontStyle: "normal",
      textAlign: "center",
      wordStyle: { ...QUOTE_WHITE_WORD },
    },
  },
};

export const QUOTE_TEMPLATE_LIST: QuoteTemplate[] = QUOTE_TEMPLATE_IDS.map(
  (id) => QUOTE_TEMPLATES[id],
);

export function resolveQuoteTemplate(
  templateId: QuoteTemplateId,
): QuoteTemplate {
  return (
    QUOTE_TEMPLATES[templateId] ?? QUOTE_TEMPLATES[DEFAULT_QUOTE_TEMPLATE_ID]
  );
}

export function resolveQuoteTemplateStyle(
  templateId: QuoteTemplateId,
): CaptionGroupStyle {
  return resolveQuoteTemplate(templateId).style;
}
