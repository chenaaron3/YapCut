import {
  CAPTION_TEMPLATE_IDS,
} from "~/domain/project/template-style";
import { TRENDING_CAPTION_Y } from "~/remotion/captions/style";

import type { CaptionTemplateId } from "~/domain/project/template-style";
import type { CaptionGroupStyle } from "~/remotion/captions/style";

export {
  CAPTION_TEMPLATE_IDS,
  DEFAULT_CAPTION_TEMPLATE_ID,
  isCaptionTemplateId,
} from "~/domain/project/template-style";
export type { CaptionTemplateId } from "~/domain/project/template-style";

export type CaptionTemplate = {
  id: CaptionTemplateId;
  label: string;
  style: CaptionGroupStyle;
};

const SHADOW = "0 3px 0 #000, 0 6px 16px rgba(0,0,0,0.85)";

export const CAPTION_TEMPLATES: Record<CaptionTemplateId, CaptionTemplate> = {
  typewriter: {
    id: "typewriter",
    label: "Typewriter",
    style: {
      fontFamily: "handwritten",
      fontSize: 72,
      y: TRENDING_CAPTION_Y,
      groupAnimation: "none",
      wordAnimation: "none",
      wordReveal: "typewriter",
      textTransform: "lowercase",
      captionsAtATime: 4,
      background: { kind: "none" },
      fontStyle: "normal",
      textAlign: "center",
      wordStyle: {
        fill: "ink",
        border: { width: 6, color: "stroke" },
        opacity: 1,
        textShadow: SHADOW,
      },
      futureWordStyle: { opacity: 0 },
    },
  },
  ugc: {
    id: "ugc",
    label: "UGC",
    style: {
      fontFamily: "clean",
      fontSize: 75,
      y: TRENDING_CAPTION_Y,
      groupAnimation: "none",
      wordAnimation: "none",
      wordReveal: "none",
      textTransform: "lowercase",
      captionsAtATime: 1,
      background: { kind: "none" },
      fontStyle: "normal",
      textAlign: "center",
      wordStyle: {
        fill: "ink",
        border: { width: 6, color: "stroke" },
        opacity: 1,
      },
    },
  },
  bold: {
    id: "bold",
    label: "Bold",
    style: {
      fontFamily: "punch",
      fontSize: 68,
      y: TRENDING_CAPTION_Y,
      groupAnimation: "none",
      wordAnimation: "none",
      wordReveal: "none",
      textTransform: "uppercase",
      captionsAtATime: 1,
      background: { kind: "none" },
      fontStyle: "normal",
      textAlign: "center",
      wordStyle: {
        fill: "ink",
        border: { width: 10, color: "stroke" },
        opacity: 1,
        textShadow: SHADOW,
      },
    },
  },
  hormozi: {
    id: "hormozi",
    label: "Hormozi",
    style: {
      fontFamily: "punch",
      fontSize: 64,
      y: TRENDING_CAPTION_Y,
      groupAnimation: "none",
      wordAnimation: "none",
      wordReveal: "none",
      textTransform: "uppercase",
      captionsAtATime: 5,
      background: { kind: "none" },
      fontStyle: "normal",
      textAlign: "center",
      wordStyle: {
        fill: "ink",
        border: { width: 8, color: "stroke" },
        opacity: 1,
        textShadow: SHADOW,
      },
      futureWordStyle: { opacity: 0.35 },
      activeWordStyle: {
        background: { kind: "rounded", color: "accent" },
      },
    },
  },
};

export const CAPTION_TEMPLATE_LIST: CaptionTemplate[] =
  CAPTION_TEMPLATE_IDS.map((id) => CAPTION_TEMPLATES[id]);
