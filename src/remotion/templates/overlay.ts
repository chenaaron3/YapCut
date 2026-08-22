import { OVERLAY_TEMPLATE_IDS } from "~/domain/project/template-style";
import { normalizeCaptionOverrides } from "~/remotion/captions/parse-style";
import { applyCaptionOverrides } from "~/remotion/captions/style";
import { resolveThemeStyle } from "~/remotion/templates/theme-style";

import type { TextBaseEdit } from "~/domain/project/project-config";
import type { OverlayTemplateId } from "~/domain/project/template-style";
import type { Theme } from "~/domain/project/theme";
import type { CaptionGroupStyle } from "~/remotion/captions/style";

export {
  DEFAULT_LISTICLE_TEMPLATE_ID,
  DEFAULT_TEXT_TEMPLATE_ID,
  isOverlayTemplateId,
  OVERLAY_TEMPLATE_IDS,
} from "~/domain/project/template-style";
export type { OverlayTemplateId } from "~/domain/project/template-style";

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

const OVERLAY_TYPEWRITER_SHADOW = "0 3px 0 #000, 0 6px 16px rgba(0,0,0,0.85)";

export const OVERLAY_TEMPLATES: Record<OverlayTemplateId, OverlayTemplate> = {
  typewriter: overlayTemplate(
    "typewriter",
    "Typewriter",
    true,
    {
      ...OVERLAY_TEXT_BASE,
      fontFamily: "handwritten",
      fontSize: 100,
      groupAnimation: "none",
      wordAnimation: "none",
      wordReveal: "typewriter",
      textTransform: "lowercase",
      background: { kind: "none" },
      arc: 75,
      wordStyle: {
        fill: "brand",
        opacity: 1,
        border: { width: 6, color: "stroke" },
        textShadow: OVERLAY_TYPEWRITER_SHADOW,
      },
      futureWordStyle: { opacity: 0 },
    },
    {
      ...OVERLAY_TEXT_BASE,
      fontFamily: "clean",
      fontSize: 75,
      groupAnimation: "wipe",
      wordAnimation: "none",
      wordReveal: "typewriter",
      textTransform: "lowercase",
      background: { kind: "ribbon", color: "accent" },
      y: -0.35,
      wordStyle: { fill: "paper", opacity: 1 },
      futureWordStyle: { opacity: 0 },
    },
  ),
  "arc-ribbon": overlayTemplate(
    "arc-ribbon",
    "Arc + Ribbon",
    true,
    {
      ...OVERLAY_TEXT_BASE,
      fontFamily: "script",
      fontSize: 125,
      groupAnimation: "none",
      wordAnimation: "none",
      wordReveal: "typewriter",
      textTransform: "none",
      background: { kind: "none" },
      y: 0,
      arc: 65,
      fontStyle: "normal",
      wordStyle: {
        fill: "brand",
        opacity: 1,
        border: { width: 10, color: "stroke" },
        textShadow: "0 3px 0 #000000, 0 0 14px rgba(0,0,0,0.9)",
      },
    },
    {
      ...OVERLAY_TEXT_BASE,
      fontFamily: "clean",
      fontSize: 75,
      groupAnimation: "scale",
      wordAnimation: "none",
      textTransform: "lowercase",
      background: { kind: "ribbon", color: "accent" },
      y: -0.5,
      wordStyle: { fill: "paper", opacity: 1 },
    },
  ),
  "wrap-pair": overlayTemplate(
    "wrap-pair",
    "Wrap",
    true,
    {
      ...OVERLAY_TEXT_BASE,
      fontFamily: "clean",
      fontSize: 75,
      groupAnimation: "fade",
      wordAnimation: "none",
      textTransform: "uppercase",
      background: { kind: "wrap", color: "brand" },
      wordStyle: { fill: "ink", opacity: 1 },
    },
    {
      ...OVERLAY_TEXT_BASE,
      fontFamily: "clean",
      fontSize: 56,
      groupAnimation: "fade",
      wordAnimation: "none",
      textTransform: "uppercase",
      background: { kind: "wrap", color: "ink" },
      y: -0.15,
      wordStyle: { fill: "paper", opacity: 1 },
    },
  ),
};

export const OVERLAY_TEMPLATE_LIST: OverlayTemplate[] =
  OVERLAY_TEMPLATE_IDS.map((id) => OVERLAY_TEMPLATES[id]);

/** Catalog + theme + overrides for a title or listicle edit. */
export function resolveOverlayForEdit(
  edit: TextBaseEdit,
  theme: Theme,
): {
  templateId: OverlayTemplateId;
  heading: CaptionGroupStyle;
  subheading: CaptionGroupStyle;
  stacked: boolean;
} {
  const templateId = edit.style.templateId;
  const template = OVERLAY_TEMPLATES[templateId];
  return {
    templateId,
    heading: applyCaptionOverrides(
      resolveThemeStyle(template.headingStyle, theme),
      normalizeCaptionOverrides(edit.style?.overrides),
    ),
    subheading: applyCaptionOverrides(
      resolveThemeStyle(template.subheadingStyle, theme),
      normalizeCaptionOverrides(edit.style?.subheadingOverrides),
    ),
    stacked: template.stacked,
  };
}

export function overlayStackedForEdit(edit: TextBaseEdit): boolean {
  return OVERLAY_TEMPLATES[edit.style.templateId].stacked;
}
