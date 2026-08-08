import { CaptionStyleFields } from "~/editor/components/inspector/CaptionStyleFields";
import { StyleTemplatePicker } from "~/editor/components/inspector/StyleTemplatePicker";
import { TextField } from "~/editor/components/inspector/field";
import { useEditor } from "~/editor/store";
import type { VfxTextEdit } from "~/domain/project-config";
import { normalizeCaptionOverrides } from "~/remotion/captions/parse-style";
import {
  mergeTextStyleOverrides,
  resolveTextTemplateId,
  resolveTextVfxStyle,
} from "~/remotion/text/resolve";
import {
  DEFAULT_TEXT_TEMPLATE_ID,
  isTextTemplateId,
  TEXT_TEMPLATE_LIST,
  type TextTemplateId,
} from "~/remotion/templates/text";

export function TextVfxInspector({ edit }: { edit: VfxTextEdit }) {
  const patchEdit = useEditor((s) => s.patchEdit);
  const templateId = resolveTextTemplateId(edit.style);
  const style = resolveTextVfxStyle(edit.style);
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
              templateId: tid as TextTemplateId,
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
            { style: mergeTextStyleOverrides(edit.style, partial) },
            live,
          )
        }
        showCaptionsAtATime={false}
      />
    </div>
  );
}
