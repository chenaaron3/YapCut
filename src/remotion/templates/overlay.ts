import {
  DEFAULT_LISTICLE_TEMPLATE_ID,
  DEFAULT_TEXT_TEMPLATE_ID,
} from "~/domain/project-config";
import { normalizeCaptionOverrides } from "~/remotion/captions/parse-style";
import { applyCaptionOverrides } from "~/remotion/captions/style";
import { resolveTemplateId } from "~/remotion/templates/style";

import type { TemplateStyle, TextBaseEdit } from "~/domain/project-config";
import type { CaptionGroupStyle } from "~/remotion/captions/style";

export const OVERLAY_TEMPLATE_IDS = [
  "arc-ribbon",
  "red-teal",
  "black-white",
  "wipe",
  "pop",
  "slide",
  "serial",
  "bounce",
  "spin",
] as const;

export type OverlayTemplateId = (typeof OVERLAY_TEMPLATE_IDS)[number];

export function isOverlayTemplateId(
  value: unknown,
): value is OverlayTemplateId {
  return (
    typeof value === "string" &&
    (OVERLAY_TEMPLATE_IDS as readonly string[]).includes(value)
  );
}

export { DEFAULT_LISTICLE_TEMPLATE_ID, DEFAULT_TEXT_TEMPLATE_ID };

/** Overlay `y` on lines after the first: fraction of previous group's height. */
const OVERLAY_TEXT_BASE = {
  y: 0,
  captionsAtATime: 1,
  fontStyle: "normal" as const,
  textAlign: "center" as const,
  wordReveal: "none" as const,
};

export type OverlayTemplate = {
  id: OverlayTemplateId;
  label: string;
  headingStyle: CaptionGroupStyle;
  subheadingStyle: CaptionGroupStyle;
  stacked: boolean;
};

function defaultSubheadingStyle(heading: CaptionGroupStyle): CaptionGroupStyle {
  return {
    ...heading,
    fontSize: Math.max(24, Math.round(heading.fontSize * 0.55)),
    groupAnimation: "scale",
    wordAnimation: "none",
    wordReveal: "none",
    arc: 0,
    background: { kind: "none" },
    wordStyle: {
      ...heading.wordStyle,
      border: null,
      textShadow: null,
    },
  };
}

function overlayTemplate(
  id: OverlayTemplateId,
  label: string,
  stacked: boolean,
  headingStyle: CaptionGroupStyle,
  subheadingStyle?: CaptionGroupStyle,
): OverlayTemplate {
  return {
    id,
    label,
    stacked,
    headingStyle,
    subheadingStyle: subheadingStyle ?? defaultSubheadingStyle(headingStyle),
  };
}

export const OVERLAY_TEMPLATES: Record<OverlayTemplateId, OverlayTemplate> = {
  "arc-ribbon": overlayTemplate(
    "arc-ribbon",
    "Arc + Ribbon",
    true,
    {
      ...OVERLAY_TEXT_BASE,
      fontFamily: "scholar-it",
      fontSize: 92,
      groupAnimation: "none",
      wordAnimation: "none",
      wordReveal: "typewriter",
      textTransform: "none",
      background: { kind: "none" },
      y: 0,
      arc: 90,
      wordStyle: {
        fill: "#FFFFFF",
        opacity: 1,
        border: { width: 10, color: "#000000" },
        textShadow: "0 3px 0 #000000, 0 0 14px rgba(0,0,0,0.9)",
      },
    },
    {
      ...OVERLAY_TEXT_BASE,
      fontFamily: "inter",
      fontSize: 48,
      groupAnimation: "scale",
      wordAnimation: "none",
      textTransform: "lowercase",
      background: { kind: "ribbon", color: "#FFFFFF" },
      y: -1,
      wordStyle: { fill: "#111111", opacity: 1 },
    },
  ),
  "red-teal": overlayTemplate(
    "red-teal",
    "Red + Teal",
    true,
    {
      ...OVERLAY_TEXT_BASE,
      fontFamily: "montserrat",
      fontSize: 52,
      groupAnimation: "fade",
      wordAnimation: "none",
      textTransform: "uppercase",
      background: { kind: "wrap", color: "#E53935" },
      wordStyle: { fill: "#FFFFFF", opacity: 1 },
    },
    {
      ...OVERLAY_TEXT_BASE,
      fontFamily: "montserrat",
      fontSize: 56,
      groupAnimation: "fade",
      wordAnimation: "none",
      textTransform: "uppercase",
      background: { kind: "wrap", color: "#5ED4DC" },
      y: -0.15,
      wordStyle: { fill: "#111111", opacity: 1 },
    },
  ),
  "black-white": overlayTemplate(
    "black-white",
    "Black + White",
    true,
    {
      ...OVERLAY_TEXT_BASE,
      fontFamily: "montserrat",
      fontSize: 52,
      groupAnimation: "fade",
      wordAnimation: "none",
      textTransform: "uppercase",
      background: { kind: "wrap", color: "#111111" },
      wordStyle: { fill: "#FFFFFF", opacity: 1 },
    },
    {
      ...OVERLAY_TEXT_BASE,
      fontFamily: "montserrat",
      fontSize: 56,
      groupAnimation: "fade",
      wordAnimation: "none",
      textTransform: "uppercase",
      background: { kind: "wrap", color: "#FFFFFF" },
      y: -0.15,
      wordStyle: { fill: "#111111", opacity: 1 },
    },
  ),
  wipe: overlayTemplate(
    "wipe",
    "Wipe",
    true,
    {
      ...OVERLAY_TEXT_BASE,
      fontFamily: "montserrat",
      fontSize: 52,
      groupAnimation: "wipe",
      wordAnimation: "none",
      textTransform: "uppercase",
      background: { kind: "box", color: "#111111" },
      wordStyle: { fill: "#FFFFFF", opacity: 1 },
    },
    {
      ...OVERLAY_TEXT_BASE,
      fontFamily: "montserrat",
      fontSize: 40,
      groupAnimation: "wipe",
      wordAnimation: "none",
      textTransform: "uppercase",
      background: { kind: "wrap" },
      y: 0.08,
      wordStyle: {
        fill: "#FFFFFF",
        opacity: 1,
        border: { width: 6, color: "#000000" },
      },
    },
  ),
  pop: overlayTemplate(
    "pop",
    "Pop",
    true,
    {
      ...OVERLAY_TEXT_BASE,
      fontFamily: "montserrat",
      fontSize: 64,
      groupAnimation: "scale",
      wordAnimation: "none",
      textTransform: "uppercase",
      background: { kind: "none" },
      wordStyle: {
        fill: "#FFFFFF",
        opacity: 1,
        border: { width: 10, color: "#000000" },
        textShadow: "0 3px 0 #000000, 0 0 14px rgba(0,0,0,0.85)",
      },
    },
    {
      ...OVERLAY_TEXT_BASE,
      fontFamily: "inter",
      fontSize: 36,
      groupAnimation: "scale",
      wordAnimation: "none",
      textTransform: "lowercase",
      background: { kind: "none" },
      y: -0.2,
      wordStyle: { fill: "#FFFFFF", opacity: 1 },
    },
  ),
  slide: overlayTemplate(
    "slide",
    "Slide",
    true,
    {
      ...OVERLAY_TEXT_BASE,
      fontFamily: "oswald",
      fontSize: 56,
      groupAnimation: "slide",
      wordAnimation: "none",
      textTransform: "uppercase",
      background: { kind: "box", color: "#111111" },
      wordStyle: { fill: "#FFFFFF", opacity: 1 },
    },
    {
      ...OVERLAY_TEXT_BASE,
      fontFamily: "oswald",
      fontSize: 32,
      groupAnimation: "slide",
      wordAnimation: "none",
      textTransform: "uppercase",
      background: { kind: "none" },
      y: 0.12,
      wordStyle: {
        fill: "#FFFFFF",
        opacity: 1,
        border: { width: 5, color: "#000000" },
      },
    },
  ),
  serial: overlayTemplate(
    "serial",
    "Serial",
    false,
    {
      ...OVERLAY_TEXT_BASE,
      fontFamily: "montserrat",
      fontSize: 56,
      groupAnimation: "fade",
      wordAnimation: "none",
      textTransform: "uppercase",
      background: { kind: "wrap", color: "#111111" },
      wordStyle: { fill: "#FFFFFF", opacity: 1 },
    },
    {
      ...OVERLAY_TEXT_BASE,
      fontFamily: "montserrat",
      fontSize: 56,
      groupAnimation: "fade",
      wordAnimation: "none",
      textTransform: "uppercase",
      background: { kind: "wrap", color: "#FFE600" },
      wordStyle: { fill: "#111111", opacity: 1 },
    },
  ),
  bounce: overlayTemplate(
    "bounce",
    "Bounce",
    true,
    {
      ...OVERLAY_TEXT_BASE,
      fontFamily: "baloo-2",
      fontSize: 68,
      groupAnimation: "bounce",
      wordAnimation: "none",
      textTransform: "uppercase",
      background: { kind: "none" },
      wordStyle: {
        fill: "#FFFFFF",
        opacity: 1,
        border: { width: 10, color: "#000000" },
        textShadow: "0 3px 0 #000000, 0 0 14px rgba(0,0,0,0.85)",
      },
    },
    {
      ...OVERLAY_TEXT_BASE,
      fontFamily: "inter",
      fontSize: 36,
      groupAnimation: "bounce",
      wordAnimation: "none",
      textTransform: "lowercase",
      background: { kind: "underline", color: "#FFE600" },
      y: -0.15,
      wordStyle: { fill: "#FFFFFF", opacity: 1 },
    },
  ),
  spin: overlayTemplate(
    "spin",
    "Spin",
    true,
    {
      ...OVERLAY_TEXT_BASE,
      fontFamily: "anton",
      fontSize: 72,
      groupAnimation: "spin",
      wordAnimation: "none",
      textTransform: "uppercase",
      background: { kind: "none" },
      wordStyle: {
        fill: "#FFFFFF",
        opacity: 1,
        border: { width: 10, color: "#000000" },
        textShadow: "0 3px 0 #000000, 0 0 14px rgba(0,0,0,0.85)",
      },
    },
    {
      ...OVERLAY_TEXT_BASE,
      fontFamily: "inter",
      fontSize: 34,
      groupAnimation: "fade",
      wordAnimation: "none",
      textTransform: "lowercase",
      background: { kind: "none" },
      y: -0.18,
      wordStyle: { fill: "#FFFFFF", opacity: 1 },
    },
  ),
};

export const OVERLAY_TEMPLATE_LIST: OverlayTemplate[] =
  OVERLAY_TEMPLATE_IDS.map((id) => OVERLAY_TEMPLATES[id]);

export function resolveOverlayTemplate(
  templateId: OverlayTemplateId,
): OverlayTemplate {
  return OVERLAY_TEMPLATES[templateId];
}

export function resolveOverlayLayerStyles(
  templateId: OverlayTemplateId,
  style?: TemplateStyle,
): {
  heading: CaptionGroupStyle;
  subheading: CaptionGroupStyle;
  stacked: boolean;
} {
  const template = resolveOverlayTemplate(templateId);
  return {
    heading: applyCaptionOverrides(
      template.headingStyle,
      normalizeCaptionOverrides(style?.overrides),
    ),
    subheading: applyCaptionOverrides(
      template.subheadingStyle,
      normalizeCaptionOverrides(style?.subheadingOverrides),
    ),
    stacked: template.stacked,
  };
}

/** Catalog + resolved heading/subheading looks for a title or listicle edit. */
export function resolveOverlayForEdit(edit: TextBaseEdit): {
  templateId: OverlayTemplateId;
  heading: CaptionGroupStyle;
  subheading: CaptionGroupStyle;
  stacked: boolean;
} {
  const title = edit.type === "text";
  const templateId = resolveTemplateId(
    edit.style,
    isOverlayTemplateId,
    title ? DEFAULT_TEXT_TEMPLATE_ID : DEFAULT_LISTICLE_TEMPLATE_ID,
  );
  return {
    templateId,
    ...resolveOverlayLayerStyles(templateId, edit.style),
  };
}

export function overlayStackedForEdit(edit: TextBaseEdit): boolean {
  return resolveOverlayForEdit(edit).stacked;
}
