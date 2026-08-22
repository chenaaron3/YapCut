import {
  CaptionStyleFields,
  EmphasisStyleFields,
  PersonFields,
  useProjectTheme,
} from "~/editor/components/inspector/field";
import { StyleTemplatePicker } from "~/editor/components/inspector/StyleTemplatePicker";
import { useEditor } from "~/editor/store";
import { applyEmphasisPatch } from "~/domain/transcript/emphasis-style";
import type { VfxQuoteEdit } from "~/domain/project/project-config";
import { normalizeCaptionOverrides } from "~/remotion/captions/parse-style";
import {
  isQuoteTemplateId,
  QUOTE_TEMPLATE_LIST,
} from "~/remotion/templates/quote";
import {
  mergeTemplateStyleOverrides,
  resolveTemplateChips,
  resolveTemplateStyle,
} from "~/remotion/templates/style";

export function QuoteVfxInspector({ edit }: { edit: VfxQuoteEdit }) {
  const patchEdit = useEditor((s) => s.patchEdit);
  const projectEmphasis = useEditor((s) => s.config?.emphasisStyle ?? {});
  const theme = useProjectTheme();
  const templateId = edit.style.templateId;
  const style = resolveTemplateStyle(edit.style, theme);
  const overrides = normalizeCaptionOverrides(edit.style?.overrides);
  const quoteEmphasis = edit.emphasisStyle ?? {};
  const hasOverride = Object.keys(quoteEmphasis).length > 0;

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <PersonFields edit={edit} />
      <StyleTemplatePicker
        templates={resolveTemplateChips(QUOTE_TEMPLATE_LIST, theme)}
        value={templateId}
        fallbackStyle={style}
        onChange={(id) => {
          const tid = isQuoteTemplateId(id) ? id : edit.style.templateId;
          const prev = normalizeCaptionOverrides(edit.style.overrides);
          const kept: { y?: number } = prev.y != null ? { y: prev.y } : {};
          patchEdit(edit.id, {
            style: {
              kind: "quote",
              templateId: tid,
              ...(Object.keys(kept).length > 0 ? { overrides: kept } : {}),
            },
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
          patchEdit(
            edit.id,
            {
              style: mergeTemplateStyleOverrides(edit.style, partial),
            },
            live,
          )
        }
      />
      <EmphasisStyleFields
        title={hasOverride ? "Emphasis override" : "Emphasis"}
        value={{ ...projectEmphasis, ...quoteEmphasis }}
        accent={theme.colors.accent}
        onClear={
          hasOverride
            ? () => patchEdit(edit.id, { emphasisStyle: {} })
            : undefined
        }
        onPatch={(partial, live) => {
          patchEdit(
            edit.id,
            { emphasisStyle: applyEmphasisPatch(quoteEmphasis, partial) },
            live,
          );
        }}
      />
    </div>
  );
}
