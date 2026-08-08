import type { TemplateStyle } from "~/domain/project-config";
import { normalizeCaptionOverrides } from "~/remotion/captions/parse-style";
import {
  applyCaptionOverrides,
  type CaptionGroupStyle,
  type CaptionStyleOverrides,
} from "~/remotion/captions/style";
import {
  DEFAULT_TEXT_TEMPLATE_ID,
  isTextTemplateId,
  resolveTextTemplateStyle,
  type TextTemplateId,
} from "~/remotion/templates/text";

export function resolveTextTemplateId(
  style: TemplateStyle | undefined,
): TextTemplateId {
  return isTextTemplateId(style?.templateId)
    ? style.templateId
    : DEFAULT_TEXT_TEMPLATE_ID;
}

/** Resolve sparse TemplateStyle → full CaptionGroupStyle for text VFX. */
export function resolveTextVfxStyle(
  style: TemplateStyle | undefined,
): CaptionGroupStyle {
  const templateId = resolveTextTemplateId(style);
  return applyCaptionOverrides(
    resolveTextTemplateStyle(templateId),
    normalizeCaptionOverrides(style?.overrides),
  );
}

export function mergeTextStyleOverrides(
  style: TemplateStyle | undefined,
  patch: CaptionStyleOverrides,
): TemplateStyle {
  const templateId = resolveTextTemplateId(style);
  const overrides = normalizeCaptionOverrides({
    ...style?.overrides,
    ...patch,
  });
  return {
    templateId,
    ...(Object.keys(overrides).length > 0 ? { overrides } : {}),
  };
}
