import { CaptionStyleFields } from "~/editor/components/inspector/CaptionStyleFields";
import { StyleTemplatePicker } from "~/editor/components/inspector/StyleTemplatePicker";
import { TextField } from "~/editor/components/inspector/field";
import type { ListiclePreviewPair } from "~/editor/components/inspector/preview/constants";
import { useEditor } from "~/editor/store";
import type { VfxTextEdit } from "~/domain/project-config";
import type { CaptionGroupStyle } from "~/remotion/captions/style";
import { normalizeCaptionOverrides } from "~/remotion/captions/parse-style";
import {
  mergeTemplateStyleOverrides,
  resolveTemplateId,
  resolveTemplateStyle,
} from "~/remotion/templates/style";
import {
  DEFAULT_TEXT_TEMPLATE_ID,
  isTextTemplateId,
  resolveTextLayerStyles,
  resolveTextTemplate,
  resolveTextTemplateStyle,
  TEXT_TEMPLATE_LIST,
  type TextTemplate,
} from "~/remotion/templates/text";

const TEXT_PAIR_HEADING = "Title";
const TEXT_PAIR_SUBHEADING = "subtitle";

function textPreviewPair(
  template: TextTemplate,
  heading?: CaptionGroupStyle,
  subheading?: CaptionGroupStyle,
): ListiclePreviewPair | undefined {
  if (!template.subheadingStyle) return undefined;
  return {
    indicator: heading ?? template.style,
    value: subheading ?? template.subheadingStyle,
    stacked: true,
    staggered: false,
    indicatorText: TEXT_PAIR_HEADING,
    valueText: TEXT_PAIR_SUBHEADING,
  };
}

export function TextVfxInspector({ edit }: { edit: VfxTextEdit }) {
  const patchEdit = useEditor((s) => s.patchEdit);
  const templateId = resolveTemplateId(
    edit.style,
    isTextTemplateId,
    DEFAULT_TEXT_TEMPLATE_ID,
  );
  const template = resolveTextTemplate(templateId);
  const style = resolveTemplateStyle(
    edit.style,
    isTextTemplateId,
    DEFAULT_TEXT_TEMPLATE_ID,
    resolveTextTemplateStyle,
  );
  const layers = resolveTextLayerStyles(templateId, edit.style?.overrides);
  const overrides = normalizeCaptionOverrides(edit.style?.overrides);

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <TextField
        id="text-vfx-content"
        label="Title"
        value={edit.text}
        multiline
        onLiveChange={(text) => patchEdit(edit.id, { text }, true)}
      />
      <TextField
        id="text-vfx-subheading"
        label="Subheading"
        value={edit.subheading ?? ""}
        onLiveChange={(subheading) =>
          patchEdit(edit.id, { subheading }, true)
        }
      />
      <StyleTemplatePicker
        templates={TEXT_TEMPLATE_LIST.map((t) => ({
          ...t,
          previewPair: textPreviewPair(t),
        }))}
        value={templateId}
        fallbackStyle={style}
        fallbackPair={textPreviewPair(
          template,
          layers.heading,
          layers.subheading,
        )}
        onChange={(id) => {
          const tid = isTextTemplateId(id) ? id : DEFAULT_TEXT_TEMPLATE_ID;
          const prev = normalizeCaptionOverrides(edit.style?.overrides);
          const kept: { y?: number } = prev.y != null ? { y: prev.y } : {};
          patchEdit(edit.id, {
            style: {
              templateId: tid,
              ...(Object.keys(kept).length > 0 ? { overrides: kept } : {}),
            },
          });
        }}
        previewVariant="static"
      />
      <CaptionStyleFields
        overrides={overrides}
        resolvedFill={style.wordStyle.fill}
        resolvedY={style.y}
        resolvedFontSize={style.fontSize}
        onPatch={(partial, live) =>
          patchEdit(
            edit.id,
            {
              style: mergeTemplateStyleOverrides(
                edit.style,
                partial,
                isTextTemplateId,
                DEFAULT_TEXT_TEMPLATE_ID,
              ),
            },
            live,
          )
        }
        showCaptionsAtATime={false}
        showArc
        resolvedArc={style.arc ?? 0}
      />
    </div>
  );
}
