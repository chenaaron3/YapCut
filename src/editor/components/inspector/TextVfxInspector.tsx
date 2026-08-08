import { CaptionStyleFields } from "~/editor/components/inspector/CaptionStyleFields";
import { StyleTemplatePicker } from "~/editor/components/inspector/StyleTemplatePicker";
import { TextField } from "~/editor/components/inspector/field";
import { useEditor } from "~/editor/store";
import type { VfxTextEdit } from "~/domain/project-config";
import { normalizeCaptionOverrides } from "~/remotion/captions/parse-style";
import {
  mergeTemplateStyleOverrides,
  resolveTemplateId,
  resolveTemplateStyle,
} from "~/remotion/templates/style";
import {
  DEFAULT_TEXT_TEMPLATE_ID,
  isTextTemplateId,
  resolveTextTemplateStyle,
  TEXT_TEMPLATE_LIST,
} from "~/remotion/templates/text";

export function TextVfxInspector({ edit }: { edit: VfxTextEdit }) {
  const patchEdit = useEditor((s) => s.patchEdit);
  const templateId = resolveTemplateId(
    edit.style,
    isTextTemplateId,
    DEFAULT_TEXT_TEMPLATE_ID,
  );
  const style = resolveTemplateStyle(
    edit.style,
    isTextTemplateId,
    DEFAULT_TEXT_TEMPLATE_ID,
    resolveTextTemplateStyle,
  );
  const overrides = normalizeCaptionOverrides(edit.style?.overrides);

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <TextField
        id="text-vfx-content"
        label="Text"
        value={edit.text}
        onLiveChange={(text) => patchEdit(edit.id, { text }, true)}
      />
      <StyleTemplatePicker
        templates={TEXT_TEMPLATE_LIST}
        value={templateId}
        fallbackStyle={style}
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
      />
    </div>
  );
}
