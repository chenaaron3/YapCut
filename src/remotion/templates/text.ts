import { QUOTE_CAPTION_Y } from '~/remotion/captions/style';

import type { CaptionGroupStyle } from '~/remotion/captions/style';

export const TEXT_TEMPLATE_IDS = [
  "simple-white",
  "simple-black",
  "white-board",
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
};

/** Default on-screen text VFX — white board title. */
export const DEFAULT_TEXT_STYLE: CaptionGroupStyle = {
  fontFamily: "proxima-nova",
  fontSize: 100,
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

export const TEXT_TEMPLATES: Record<TextTemplateId, TextTemplate> = {
  "simple-white": {
    id: "simple-white",
    label: "Simple White",
    style: {
      fontFamily: "proxima-nova",
      fontSize: 100,
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
      fontSize: 100,
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
