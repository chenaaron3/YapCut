import {
  DEFAULT_CAPTION_STYLE,
  TRENDING_CAPTION_Y,
  type CaptionGroupStyle,
} from "~/remotion/captions/style";

export const CAPTION_TEMPLATE_IDS = [
  "typewriter",
  "ugc",
  "bold",
  "hormozi",
  "wipe",
  "boxed",
  "fade",
  "wrap",
  "pop",
  "bounce",
  "underline",
] as const;

export type CaptionTemplateId = (typeof CAPTION_TEMPLATE_IDS)[number];

export function isCaptionTemplateId(
  value: unknown,
): value is CaptionTemplateId {
  return (
    typeof value === "string" &&
    (CAPTION_TEMPLATE_IDS as readonly string[]).includes(value)
  );
}

export type CaptionTemplate = {
  id: CaptionTemplateId;
  label: string;
  style: CaptionGroupStyle;
};

export const DEFAULT_CAPTION_TEMPLATE_ID: CaptionTemplateId = "ugc";

const SHADOW = "0 3px 0 #000, 0 6px 16px rgba(0,0,0,0.85)";

export const CAPTION_TEMPLATES: Record<CaptionTemplateId, CaptionTemplate> = {
  typewriter: {
    id: "typewriter",
    label: "Typewriter",
    style: { ...DEFAULT_CAPTION_STYLE },
  },
  ugc: {
    id: "ugc",
    label: "UGC",
    style: {
      fontFamily: "inter",
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
        fill: "#FFFFFF",
        border: { width: 6, color: "#000000" },
        opacity: 1,
      },
    },
  },
  bold: {
    id: "bold",
    label: "Bold",
    style: {
      fontFamily: "montserrat",
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
        fill: "#FFFFFF",
        border: { width: 10, color: "#000000" },
        opacity: 1,
        textShadow: SHADOW,
      },
    },
  },
  hormozi: {
    id: "hormozi",
    label: "Hormozi",
    style: {
      fontFamily: "montserrat",
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
        fill: "#FFFFFF",
        border: { width: 8, color: "#000000" },
        opacity: 1,
        textShadow: SHADOW,
      },
      futureWordStyle: { opacity: 0.35 },
      activeWordStyle: {
        background: { kind: "rounded", color: "#FFE600" },
      },
    },
  },
  wipe: {
    id: "wipe",
    label: "Wipe",
    style: {
      fontFamily: "montserrat",
      fontSize: 68,
      y: TRENDING_CAPTION_Y,
      groupAnimation: "none",
      wordAnimation: "wipe",
      wordReveal: "none",
      textTransform: "uppercase",
      captionsAtATime: 1,
      background: { kind: "none" },
      fontStyle: "normal",
      textAlign: "center",
      wordStyle: {
        fill: "#FFFFFF",
        border: { width: 10, color: "#000000" },
        opacity: 1,
        textShadow: SHADOW,
      },
    },
  },
  boxed: {
    id: "boxed",
    label: "Boxed",
    style: {
      fontFamily: "anton",
      fontSize: 72,
      y: TRENDING_CAPTION_Y,
      groupAnimation: "none",
      wordAnimation: "none",
      wordReveal: "none",
      textTransform: "uppercase",
      captionsAtATime: 3,
      background: { kind: "box", color: "rgba(0, 0, 0, 0.88)" },
      fontStyle: "normal",
      textAlign: "center",
      wordStyle: {
        fill: "#FFFFFF",
        opacity: 1,
      },
    },
  },
  fade: {
    id: "fade",
    label: "Fade",
    style: {
      fontFamily: "montserrat",
      fontSize: 68,
      y: TRENDING_CAPTION_Y,
      groupAnimation: "none",
      wordAnimation: "fade",
      wordReveal: "none",
      textTransform: "uppercase",
      captionsAtATime: 4,
      background: { kind: "none" },
      fontStyle: "normal",
      textAlign: "center",
      wordStyle: {
        fill: "#FFFFFF",
        border: { width: 8, color: "#000000" },
        opacity: 1,
        textShadow: SHADOW,
      },
    },
  },
  wrap: {
    id: "wrap",
    label: "Wrap",
    style: {
      fontFamily: "nunito",
      fontSize: 62,
      y: TRENDING_CAPTION_Y,
      groupAnimation: "none",
      wordAnimation: "none",
      wordReveal: "none",
      textTransform: "uppercase",
      captionsAtATime: 4,
      background: { kind: "wrap", color: "#FFFFFF" },
      fontStyle: "normal",
      textAlign: "center",
      wordStyle: {
        fill: "#111111",
        opacity: 1,
      },
    },
  },
  pop: {
    id: "pop",
    label: "Pop",
    style: {
      fontFamily: "montserrat",
      fontSize: 68,
      y: TRENDING_CAPTION_Y,
      groupAnimation: "none",
      wordAnimation: "scale",
      wordReveal: "none",
      textTransform: "uppercase",
      captionsAtATime: 1,
      background: { kind: "none" },
      fontStyle: "normal",
      textAlign: "center",
      wordStyle: {
        fill: "#FFFFFF",
        border: { width: 10, color: "#000000" },
        opacity: 1,
        textShadow: SHADOW,
      },
    },
  },
  bounce: {
    id: "bounce",
    label: "Bounce",
    style: {
      fontFamily: "baloo-2",
      fontSize: 70,
      y: TRENDING_CAPTION_Y,
      groupAnimation: "none",
      wordAnimation: "bounce",
      wordReveal: "none",
      textTransform: "uppercase",
      captionsAtATime: 3,
      background: { kind: "none" },
      fontStyle: "normal",
      textAlign: "center",
      wordStyle: {
        fill: "#FFFFFF",
        border: { width: 8, color: "#000000" },
        opacity: 1,
        textShadow: SHADOW,
      },
    },
  },
  underline: {
    id: "underline",
    label: "Underline",
    style: {
      fontFamily: "oswald",
      fontSize: 64,
      y: TRENDING_CAPTION_Y,
      groupAnimation: "none",
      wordAnimation: "none",
      wordReveal: "none",
      textTransform: "uppercase",
      captionsAtATime: 4,
      background: { kind: "underline", color: "#FFE600" },
      fontStyle: "normal",
      textAlign: "center",
      wordStyle: {
        fill: "#FFFFFF",
        border: { width: 6, color: "#000000" },
        opacity: 1,
        textShadow: SHADOW,
      },
    },
  },
};

export const CAPTION_TEMPLATE_LIST: CaptionTemplate[] =
  CAPTION_TEMPLATE_IDS.map((id) => CAPTION_TEMPLATES[id]);

export function resolveCaptionTemplate(
  templateId: CaptionTemplateId,
): CaptionTemplate {
  return (
    CAPTION_TEMPLATES[templateId] ??
    CAPTION_TEMPLATES[DEFAULT_CAPTION_TEMPLATE_ID]
  );
}

export function resolveCaptionTemplateStyle(
  templateId: CaptionTemplateId,
): CaptionGroupStyle {
  return resolveCaptionTemplate(templateId).style;
}

export function defaultCaptionStyle(): CaptionGroupStyle {
  return { ...DEFAULT_CAPTION_STYLE };
}
