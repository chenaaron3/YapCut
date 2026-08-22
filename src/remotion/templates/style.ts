import type {
  CaptionTemplateStyle,
  QuoteTemplateStyle,
  TemplateStyle,
} from "~/domain/project/template-style";
import type { Theme } from "~/domain/project/theme";
import { normalizeCaptionOverrides } from "~/remotion/captions/parse-style";
import {
  applyCaptionOverrides,
  type CaptionGroupStyle,
  type CaptionStyleOverrides,
} from "~/remotion/captions/style";
import { CAPTION_TEMPLATES } from "~/remotion/templates/caption";
import { QUOTE_TEMPLATES } from "~/remotion/templates/quote";
import { resolveThemeStyle } from "~/remotion/templates/theme-style";

/** Resolve catalog roles against Theme for picker chips. */
export function resolveTemplateChips(
  templates: readonly {
    id: string;
    label: string;
    style: CaptionGroupStyle;
  }[],
  theme: Theme,
): { id: string; label: string; style: CaptionGroupStyle }[] {
  return templates.map((t) => ({
    id: t.id,
    label: t.label,
    style: resolveThemeStyle(t.style, theme),
  }));
}

/** Caption/quote TemplateStyle → catalog → theme → overrides. */
export function resolveTemplateStyle(
  style: CaptionTemplateStyle | QuoteTemplateStyle,
  theme: Theme,
): CaptionGroupStyle {
  const entry =
    style.kind === "caption"
      ? CAPTION_TEMPLATES[style.templateId]
      : QUOTE_TEMPLATES[style.templateId];
  return applyCaptionOverrides(
    resolveThemeStyle(entry.style, theme),
    normalizeCaptionOverrides(style.overrides),
  );
}

/** Merge sparse overrides onto a TemplateStyle (keeps kind + templateId). */
export function mergeTemplateStyleOverrides<T extends TemplateStyle>(
  style: T,
  patch: CaptionStyleOverrides,
  bag: "overrides" | "subheadingOverrides" = "overrides",
): T {
  const currentSub =
    style.kind === "overlay" ? style.subheadingOverrides : undefined;
  const heading = normalizeCaptionOverrides(
    bag === "overrides" ? { ...style.overrides, ...patch } : style.overrides,
  );
  const subheading = normalizeCaptionOverrides(
    bag === "subheadingOverrides" ? { ...currentSub, ...patch } : currentSub,
  );
  return {
    kind: style.kind,
    templateId: style.templateId,
    ...(Object.keys(heading).length > 0 ? { overrides: heading } : {}),
    ...(style.kind === "overlay" && Object.keys(subheading).length > 0
      ? { subheadingOverrides: subheading }
      : {}),
  } as T;
}
