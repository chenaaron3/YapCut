import { QUOTE_TEMPLATE_IDS } from "~/domain/project/template-style";
import { QUOTE_CAPTION_Y } from "~/remotion/captions/style";

import type { QuoteTemplateId } from "~/domain/project/template-style";
import type { CaptionGroupStyle } from "~/remotion/captions/style";

export {
  DEFAULT_QUOTE_TEMPLATE_ID,
  isQuoteTemplateId,
  QUOTE_TEMPLATE_IDS,
} from "~/domain/project/template-style";
export type { QuoteTemplateId } from "~/domain/project/template-style";

export type QuoteTemplate = {
  id: QuoteTemplateId;
  label: string;
  style: CaptionGroupStyle;
};

const QUOTE_TEXT_SHADOW = "0 2px 0 #000, 0 4px 14px rgba(0,0,0,0.8)";

const QUOTE_INK_WORD = {
  fill: "ink" as const,
  opacity: 1,
  border: { width: 6, color: "stroke" as const },
  textShadow: QUOTE_TEXT_SHADOW,
};

export const QUOTE_TEMPLATES: Record<QuoteTemplateId, QuoteTemplate> = {
  "bold-white": {
    id: "bold-white",
    label: "Bold White",
    style: {
      fontFamily: "clean",
      fontSize: 125,
      y: QUOTE_CAPTION_Y,
      groupAnimation: "none",
      wordAnimation: "none",
      wordReveal: "none",
      textTransform: "uppercase",
      captionsAtATime: 1,
      background: { kind: "none" },
      fontStyle: "normal",
      textAlign: "center",
      wordStyle: { ...QUOTE_INK_WORD },
    },
  },
  typewriter: {
    id: "typewriter",
    label: "Typewriter",
    style: {
      fontFamily: "handwritten",
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
      wordStyle: {
        fill: "ink",
        opacity: 1,
        border: { width: 5, color: "stroke" },
        textShadow: QUOTE_TEXT_SHADOW,
      },
      futureWordStyle: { opacity: 0 },
    },
  },
  pop: {
    id: "pop",
    label: "Pop",
    style: {
      fontFamily: "punch",
      fontSize: 88,
      y: QUOTE_CAPTION_Y,
      groupAnimation: "none",
      wordAnimation: "scale",
      wordReveal: "none",
      textTransform: "uppercase",
      captionsAtATime: 1,
      background: { kind: "none" },
      fontStyle: "normal",
      textAlign: "center",
      wordStyle: { ...QUOTE_INK_WORD },
    },
  },
};

export const QUOTE_TEMPLATE_LIST: QuoteTemplate[] = QUOTE_TEMPLATE_IDS.map(
  (id) => QUOTE_TEMPLATES[id],
);

