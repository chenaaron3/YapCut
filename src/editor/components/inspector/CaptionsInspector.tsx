import { CaptionStyleFields } from "~/editor/components/inspector/CaptionStyleFields";
import { EmphasisStyleFields } from "~/editor/components/inspector/EmphasisStyleFields";
import { StyleTemplatePicker } from "~/editor/components/inspector/StyleTemplatePicker";
import { useEditor } from "~/editor/store";
import { applyEmphasisPatch } from "~/domain/emphasis-style";
import { normalizeCaptionOverrides } from "~/remotion/captions/parse-style";
import { applyCaptionOverrides } from "~/remotion/captions/style";
import {
  CAPTION_TEMPLATE_LIST,
  DEFAULT_CAPTION_TEMPLATE_ID,
  isCaptionTemplateId,
  resolveCaptionTemplateStyle,
} from "~/remotion/templates/caption";

export function CaptionsInspector() {
  const config = useEditor((s) => s.config);
  const patchCaptions = useEditor((s) => s.patchCaptions);
  const patchEmphasisStyle = useEditor((s) => s.patchEmphasisStyle);

  const templateId = isCaptionTemplateId(config?.captions.templateId)
    ? config.captions.templateId
    : DEFAULT_CAPTION_TEMPLATE_ID;
  const overrides = normalizeCaptionOverrides(config?.captions.overrides);
  const style = applyCaptionOverrides(
    resolveCaptionTemplateStyle(templateId),
    overrides,
  );
  const emphasisStyle = config?.emphasisStyle ?? {};

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <StyleTemplatePicker
        templates={CAPTION_TEMPLATE_LIST}
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
        onPatch={(partial, live) =>
          patchEmphasisStyle(applyEmphasisPatch(emphasisStyle, partial), live)
        }
      />
    </div>
  );
}
