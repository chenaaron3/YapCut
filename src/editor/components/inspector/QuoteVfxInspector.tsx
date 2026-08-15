import {
  CaptionStyleFields,
  EmphasisStyleFields,
} from "~/editor/components/inspector/field";
import { StyleTemplatePicker } from "~/editor/components/inspector/StyleTemplatePicker";
import { useEditor } from "~/editor/store";
import { applyEmphasisPatch } from "~/domain/emphasis-style";
import type { VfxQuoteEdit } from "~/domain/project-config";
import { normalizeCaptionOverrides } from "~/remotion/captions/parse-style";
import {
  DEFAULT_QUOTE_TEMPLATE_ID,
  isQuoteTemplateId,
  QUOTE_TEMPLATE_LIST,
  resolveQuoteTemplateStyle,
} from "~/remotion/templates/quote";
import {
  mergeTemplateStyleOverrides,
  resolveTemplateId,
  resolveTemplateStyle,
} from "~/remotion/templates/style";

export function QuoteVfxInspector({ edit }: { edit: VfxQuoteEdit }) {
  const patchEdit = useEditor((s) => s.patchEdit);
  const projectEmphasis = useEditor((s) => s.config?.emphasisStyle ?? {});
  const templateId = resolveTemplateId(
    edit.style,
    isQuoteTemplateId,
    DEFAULT_QUOTE_TEMPLATE_ID,
  );
  const style = resolveTemplateStyle(
    edit.style,
    isQuoteTemplateId,
    DEFAULT_QUOTE_TEMPLATE_ID,
    resolveQuoteTemplateStyle,
  );
  const overrides = normalizeCaptionOverrides(edit.style?.overrides);
  const quoteEmphasis = edit.emphasisStyle ?? {};
  const hasOverride = Object.keys(quoteEmphasis).length > 0;

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <StyleTemplatePicker
        templates={QUOTE_TEMPLATE_LIST}
        value={templateId}
        fallbackStyle={style}
        onChange={(id) => {
          const tid = isQuoteTemplateId(id) ? id : DEFAULT_QUOTE_TEMPLATE_ID;
          const prev = normalizeCaptionOverrides(edit.style?.overrides);
          const kept: { y?: number } = prev.y != null ? { y: prev.y } : {};
          patchEdit(edit.id, {
            style: {
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
              style: mergeTemplateStyleOverrides(
                edit.style,
                partial,
                isQuoteTemplateId,
                DEFAULT_QUOTE_TEMPLATE_ID,
              ),
            },
            live,
          )
        }
      />
      <EmphasisStyleFields
        title={hasOverride ? "Emphasis override" : "Emphasis"}
        value={{ ...projectEmphasis, ...quoteEmphasis }}
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
