import type { TemplateStyle } from "~/domain/project-config";
import { normalizeCaptionOverrides } from "~/remotion/captions/parse-style";
import {
  applyCaptionOverrides,
  type CaptionGroupStyle,
  type CaptionStyleOverrides,
} from "~/remotion/captions/style";

/** Resolve sparse TemplateStyle.templateId against a catalog (+ default). */
export function resolveTemplateId<T extends string>(
  style: TemplateStyle | undefined,
  isId: (value: unknown) => value is T,
  defaultId: T,
): T {
  return isId(style?.templateId) ? style.templateId : defaultId;
}

/** Resolve sparse TemplateStyle → full CaptionGroupStyle. */
export function resolveTemplateStyle<T extends string>(
  style: TemplateStyle | undefined,
  isId: (value: unknown) => value is T,
  defaultId: T,
  resolveBase: (id: T) => CaptionGroupStyle,
): CaptionGroupStyle {
  const templateId = resolveTemplateId(style, isId, defaultId);
  return applyCaptionOverrides(
    resolveBase(templateId),
    normalizeCaptionOverrides(style?.overrides),
  );
}

/** Merge sparse overrides onto a TemplateStyle (keeps resolved templateId). */
export function mergeTemplateStyleOverrides<T extends string>(
  style: TemplateStyle | undefined,
  patch: CaptionStyleOverrides,
  isId: (value: unknown) => value is T,
  defaultId: T,
): TemplateStyle {
  const templateId = resolveTemplateId(style, isId, defaultId);
  const overrides = normalizeCaptionOverrides({
    ...style?.overrides,
    ...patch,
  });
  return {
    templateId,
    ...(Object.keys(overrides).length > 0 ? { overrides } : {}),
  };
}
