import { clampListicleMiddle } from "~/domain/listicle";
import { TextField } from "~/editor/components/inspector/field";
import { StyleTemplatePicker } from "~/editor/components/inspector/StyleTemplatePicker";
import { useEditor } from "~/editor/store";
import {
  DEFAULT_LISTICLE_TEMPLATE_ID,
  isListicleTemplateId,
  LISTICLE_TEMPLATE_LIST,
  resolveListicleTemplate,
} from "~/remotion/templates/listicle";

import type { VfxListicleEdit } from "~/domain/project-config";

export function ListicleVfxInspector({ edit }: { edit: VfxListicleEdit }) {
  const patchEdit = useEditor((s) => s.patchEdit);
  const patchListicleStyle = useEditor((s) => s.patchListicleStyle);
  const listicleStyle = useEditor((s) => s.config?.listicleStyle);

  const templateId = isListicleTemplateId(listicleStyle?.templateId)
    ? listicleStyle.templateId
    : DEFAULT_LISTICLE_TEMPLATE_ID;
  const template = resolveListicleTemplate(templateId);
  const staggered = edit.middle != null;

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <TextField
        id="listicle-indicator"
        label="Indicator"
        value={edit.indicatorText}
        onLiveChange={(indicatorText) =>
          patchEdit(edit.id, { indicatorText }, true)
        }
      />
      <TextField
        id="listicle-value"
        label="Value"
        value={edit.valueText}
        onLiveChange={(valueText) => patchEdit(edit.id, { valueText }, true)}
      />

      <label className="text-foreground flex cursor-pointer items-center gap-2 text-xs">
        <input
          type="checkbox"
          className="accent-primary size-3.5"
          checked={staggered}
          onChange={(e) => {
            if (e.target.checked) {
              const middle = clampListicleMiddle(
                edit.start,
                (edit.start + edit.end) / 2,
                edit.end,
              );
              patchEdit(edit.id, { middle });
            } else {
              patchEdit(edit.id, { middle: null });
            }
          }}
        />
        Stagger reveal
      </label>

      <label className="text-foreground flex cursor-pointer items-center gap-2 text-xs">
        <input
          type="checkbox"
          className="accent-primary size-3.5"
          checked={edit.hideCaptions}
          onChange={(e) =>
            patchEdit(edit.id, { hideCaptions: e.target.checked })
          }
        />
        Hide captions
      </label>

      <StyleTemplatePicker
        templates={LISTICLE_TEMPLATE_LIST}
        value={templateId}
        fallbackStyle={template.style}
        onChange={(id) => {
          const tid = isListicleTemplateId(id)
            ? id
            : DEFAULT_LISTICLE_TEMPLATE_ID;
          patchListicleStyle({ templateId: tid });
        }}
        previewVariant="static"
      />
    </div>
  );
}
