import { DEFAULT_CAPTION_TEMPLATE_ID } from "~/domain/project-config";

export type CaptionTemplateId = "hormozi" | "bold" | "ugc" | "typewriter";

export type CaptionResolvedStyle = {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  textTransform: "none" | "uppercase" | "lowercase";
  captionsAtATime: number;
  fill: string;
  activeBackground: string | null;
  futureOpacity: number;
  textShadow: string;
  borderWidth: number;
  borderColor: string;
};

const SHADOW = "0 3px 0 #000, 0 6px 16px rgba(0,0,0,0.85)";

const TEMPLATES: Record<CaptionTemplateId, CaptionResolvedStyle> = {
  hormozi: {
    fontFamily: '"Montserrat", "Arial Black", Impact, sans-serif',
    fontSize: 64,
    fontWeight: 900,
    textTransform: "uppercase",
    captionsAtATime: 5,
    fill: "#FFFFFF",
    activeBackground: "#FFE600",
    futureOpacity: 0.35,
    textShadow: SHADOW,
    borderWidth: 8,
    borderColor: "#000000",
  },
  bold: {
    fontFamily: '"Montserrat", "Arial Black", Impact, sans-serif',
    fontSize: 68,
    fontWeight: 900,
    textTransform: "uppercase",
    captionsAtATime: 1,
    fill: "#FFFFFF",
    activeBackground: null,
    futureOpacity: 0.35,
    textShadow: SHADOW,
    borderWidth: 10,
    borderColor: "#000000",
  },
  ugc: {
    fontFamily: '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif',
    fontSize: 40,
    fontWeight: 700,
    textTransform: "lowercase",
    captionsAtATime: 5,
    fill: "#FFFFFF",
    activeBackground: null,
    futureOpacity: 0.35,
    textShadow: "none",
    borderWidth: 6,
    borderColor: "#000000",
  },
  typewriter: {
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: 48,
    fontWeight: 700,
    textTransform: "none",
    captionsAtATime: 4,
    fill: "#FFFFFF",
    activeBackground: null,
    futureOpacity: 0.4,
    textShadow: SHADOW,
    borderWidth: 4,
    borderColor: "#000000",
  },
};

export function resolveCaptionStyle(
  templateId: string,
  overrides?: Record<string, unknown>,
): CaptionResolvedStyle {
  const id = (
    templateId in TEMPLATES ? templateId : DEFAULT_CAPTION_TEMPLATE_ID
  ) as CaptionTemplateId;
  const base = { ...TEMPLATES[id] };
  if (!overrides) return base;
  if (typeof overrides.fontSize === "number") base.fontSize = overrides.fontSize;
  if (typeof overrides.captionsAtATime === "number") {
    base.captionsAtATime = overrides.captionsAtATime;
  }
  return base;
}

export function transformCaptionText(
  text: string,
  transform: CaptionResolvedStyle["textTransform"],
): string {
  if (transform === "uppercase") return text.toUpperCase();
  if (transform === "lowercase") return text.toLowerCase();
  return text;
}
