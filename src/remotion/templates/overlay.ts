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

/** Overlay line y is own-height translate; 0 = no shift. */
const OVERLAY_TEXT_BASE = {
  y: 0,
  captionsAtATime: 1,
  fontStyle: "normal" as const,
  textAlign: "center" as const,
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
    animation: "scale",
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
      fontFamily: "great-vibes",
      fontSize: 92,
      animation: "typewriter",
      textTransform: "none",
      background: { kind: "none" },
      y: 0.2,
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
      animation: "scale",
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
      animation: "fade",
      textTransform: "uppercase",
      background: { kind: "box", color: "#E53935" },
      wordStyle: { fill: "#FFFFFF", opacity: 1 },
    },
    {
      ...OVERLAY_TEXT_BASE,
      fontFamily: "montserrat",
      fontSize: 56,
      animation: "fade",
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
      animation: "fade",
      textTransform: "uppercase",
      background: { kind: "box", color: "#111111" },
      wordStyle: { fill: "#FFFFFF", opacity: 1 },
    },
    {
      ...OVERLAY_TEXT_BASE,
      fontFamily: "montserrat",
      fontSize: 56,
      animation: "fade",
      textTransform: "uppercase",
      background: { kind: "wrap", color: "#FFFFFF" },
      y: -0.15,
      wordStyle: { fill: "#111111", opacity: 1 },
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
