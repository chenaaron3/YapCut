import { CaptionStyleFields } from "~/editor/components/inspector/CaptionStyleFields";
import { EmphasisStyleFields } from "~/editor/components/inspector/EmphasisStyleFields";
import { StyleTemplatePicker } from "~/editor/components/inspector/StyleTemplatePicker";
import { useEditor } from "~/editor/store";
import {
  normalizeEmphasisStyle,
  normalizeQuoteEmphasisStyle,
  resolveEmphasisStyle,
} from "~/domain/emphasis-style";
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
  // Normalize outside the selector — a new object each snapshot loops.
  const projectEmphasisRaw = useEditor((s) => s.config?.emphasisStyle);
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
  const quoteEmphasis = normalizeQuoteEmphasisStyle(edit.emphasisStyle);
  const projectResolved = resolveEmphasisStyle(
    normalizeEmphasisStyle(projectEmphasisRaw),
  );

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
        mode="quote"
        value={quoteEmphasis}
        projectResolved={{
          scale: projectResolved.scale,
          fill: projectResolved.fill ?? style.wordStyle.fill,
          fontFamily: projectResolved.fontFamily,
        }}
        onChange={(next, live) => {
          const normalized = normalizeQuoteEmphasisStyle(next);
          patchEdit(
            edit.id,
            {
              emphasisStyle:
                Object.keys(normalized).length > 0 ? normalized : null,
            },
            live,
          );
        }}
      />
    </div>
  );
}
