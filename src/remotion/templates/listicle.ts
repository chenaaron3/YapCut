import { normalizeCaptionOverrides } from "~/remotion/captions/parse-style";
import {
  applyCaptionOverrides,
  QUOTE_CAPTION_Y,
  type CaptionGroupStyle,
} from "~/remotion/captions/style";

export const LISTICLE_TEMPLATE_IDS = ["black-board", "red-teal"] as const;

export type ListicleTemplateId = (typeof LISTICLE_TEMPLATE_IDS)[number];

export function isListicleTemplateId(
  value: unknown,
): value is ListicleTemplateId {
  return (
    typeof value === "string" &&
    (LISTICLE_TEMPLATE_IDS as readonly string[]).includes(value)
  );
}

export const DEFAULT_LISTICLE_TEMPLATE_ID: ListicleTemplateId = "black-board";

const STACK_Y = QUOTE_CAPTION_Y;

/** Shared base for listicle text phases. */
const LISTICLE_TEXT_BASE = {
  fontFamily: "montserrat" as const,
  y: STACK_Y,
  animation: "fade" as const,
  captionsAtATime: 1,
  fontStyle: "normal" as const,
  textAlign: "center" as const,
};

export type ListicleTemplate = {
  id: ListicleTemplateId;
  label: string;
  indicatorStyle: CaptionGroupStyle;
  valueStyle: CaptionGroupStyle;
  /**
   * Positional: indicator above value when both are visible.
   * Timing is separate (`middle` on the edit).
   */
  stacked: boolean;
  /** Preview style for the inspector chip (value look). */
  style: CaptionGroupStyle;
};

export const LISTICLE_TEMPLATES: Record<ListicleTemplateId, ListicleTemplate> =
  {
    /** Black indicator over white board — not stacked (serial when staggered). */
    "black-board": {
      id: "black-board",
      label: "Black + Board",
      stacked: false,
      indicatorStyle: {
        ...LISTICLE_TEXT_BASE,
        fontSize: 56,
        textTransform: "none",
        background: { kind: "none" },
        wordStyle: { fill: "#111111", opacity: 1 },
      },
      valueStyle: {
        ...LISTICLE_TEXT_BASE,
        fontSize: 62,
        textTransform: "none",
        background: { kind: "wrap", color: "#FFFFFF" },
        wordStyle: { fill: "#111111", opacity: 1 },
      },
      style: {
        ...LISTICLE_TEXT_BASE,
        fontSize: 62,
        textTransform: "none",
        background: { kind: "wrap", color: "#FFFFFF" },
        wordStyle: { fill: "#111111", opacity: 1 },
      },
    },
    /** Red indicator over teal value — stacked. */
    "red-teal": {
      id: "red-teal",
      label: "Red + Teal",
      stacked: true,
      indicatorStyle: {
        ...LISTICLE_TEXT_BASE,
        fontSize: 52,
        textTransform: "uppercase",
        background: { kind: "box", color: "#E53935" },
        wordStyle: { fill: "#FFFFFF", opacity: 1 },
      },
      valueStyle: {
        ...LISTICLE_TEXT_BASE,
        fontSize: 56,
        textTransform: "uppercase",
        background: { kind: "wrap", color: "#5ED4DC" },
        wordStyle: { fill: "#111111", opacity: 1 },
      },
      style: {
        ...LISTICLE_TEXT_BASE,
        fontSize: 56,
        textTransform: "uppercase",
        background: { kind: "wrap", color: "#5ED4DC" },
        wordStyle: { fill: "#111111", opacity: 1 },
      },
    },
  };

export const LISTICLE_TEMPLATE_LIST: ListicleTemplate[] =
  LISTICLE_TEMPLATE_IDS.map((id) => LISTICLE_TEMPLATES[id]);

export function resolveListicleTemplate(
  templateId: ListicleTemplateId,
): ListicleTemplate {
  return (
    LISTICLE_TEMPLATES[templateId] ??
    LISTICLE_TEMPLATES[DEFAULT_LISTICLE_TEMPLATE_ID]
  );
}

export function resolveListicleTextStyles(
  templateId: string,
  overrides?: Record<string, unknown>,
): {
  indicator: CaptionGroupStyle;
  value: CaptionGroupStyle;
  stacked: boolean;
} {
  const tid = isListicleTemplateId(templateId)
    ? templateId
    : DEFAULT_LISTICLE_TEMPLATE_ID;
  const template = resolveListicleTemplate(tid);
  const normalized = normalizeCaptionOverrides(overrides);
  return {
    indicator: applyCaptionOverrides(template.indicatorStyle, normalized),
    value: applyCaptionOverrides(template.valueStyle, normalized),
    stacked: template.stacked,
  };
}
