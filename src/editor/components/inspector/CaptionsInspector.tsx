import {
  CaptionStyleFields,
  EmphasisStyleFields,
  useProjectTheme,
} from "~/editor/components/inspector/field";
import { StyleTemplatePicker } from "~/editor/components/inspector/StyleTemplatePicker";
import { useEditor } from "~/editor/store";
import { applyEmphasisPatch } from "~/domain/transcript/emphasis-style";
import { captionTemplateStyle } from "~/domain/project/template-style";
import { normalizeCaptionOverrides } from "~/remotion/captions/parse-style";
import {
  CAPTION_TEMPLATE_LIST,
  isCaptionTemplateId,
} from "~/remotion/templates/caption";
import {
  resolveTemplateChips,
  resolveTemplateStyle,
} from "~/remotion/templates/style";

export function CaptionsInspector() {
  const config = useEditor((s) => s.config);
  const patchCaptions = useEditor((s) => s.patchCaptions);
  const patchEmphasisStyle = useEditor((s) => s.patchEmphasisStyle);
  const theme = useProjectTheme();

  const captions = config?.captions ?? captionTemplateStyle();
  const templateId = captions.templateId;
  const overrides = normalizeCaptionOverrides(captions.overrides);
  const style = resolveTemplateStyle(captions, theme);
  const emphasisStyle = config?.emphasisStyle ?? {};

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <StyleTemplatePicker
        templates={resolveTemplateChips(CAPTION_TEMPLATE_LIST, theme)}
        value={templateId}
        fallbackStyle={style}
        onChange={(id) => {
          if (!isCaptionTemplateId(id)) return;
          // Template switch keeps Y only.
          const kept =
            overrides.y != null ? { y: overrides.y } : undefined;
          patchCaptions({
            templateId: id,
            overrides: kept,
          });
        }}
      />
      <CaptionStyleFields
        overrides={overrides}
        resolvedFill={style.wordStyle.fill}
        resolvedY={style.y}
        resolvedFontSize={style.fontSize}
        resolvedFontFamily={style.fontFamily}
        resolvedCaptionsAtATime={style.captionsAtATime}
        onPatch={(partial, live) =>
          patchCaptions(
            {
              overrides: normalizeCaptionOverrides({
                ...overrides,
                ...partial,
              }),
            },
            live,
          )
        }
      />
      <EmphasisStyleFields
        value={emphasisStyle}
        accent={theme.colors.accent}
        handwritten={theme.fonts.handwritten}
        onPatch={(partial, live) =>
          patchEmphasisStyle(applyEmphasisPatch(emphasisStyle, partial), live)
        }
      />
    </div>
  );
}
