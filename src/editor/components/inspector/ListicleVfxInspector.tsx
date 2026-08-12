import { clampListicleMiddle } from "~/domain/listicle";
import { SliderField, TextField } from "~/editor/components/inspector/field";
import { StyleTemplatePicker } from "~/editor/components/inspector/StyleTemplatePicker";
import { useEditor } from "~/editor/store";
import { normalizeCaptionOverrides } from "~/remotion/captions/parse-style";
import { applyCaptionOverrides } from "~/remotion/captions/style";
import {
  DEFAULT_LISTICLE_TEMPLATE_ID,
  isListicleTemplateId,
  LISTICLE_TEMPLATE_LIST,
  resolveListicleTemplate,
  resolveListicleTextStyles,
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
  const overrides = normalizeCaptionOverrides(listicleStyle?.overrides);
  const styles = resolveListicleTextStyles(templateId, overrides);
  const fallbackStyle = applyCaptionOverrides(template.style, overrides);
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
        multiline
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

      <SliderField
        label="Y (safe area)"
        value={styles.value.y}
        min={0}
        max={1}
        step={0.01}
        display={styles.value.y.toFixed(2)}
        onLiveChange={(y) =>
          patchListicleStyle(
            {
              overrides: normalizeCaptionOverrides({ ...overrides, y }),
            },
            true,
          )
        }
        onCommit={(y) =>
          patchListicleStyle(
            {
              overrides: normalizeCaptionOverrides({ ...overrides, y }),
            },
            true,
          )
        }
      />

      <StyleTemplatePicker
        templates={LISTICLE_TEMPLATE_LIST.map((t) => ({
          ...t,
          previewPair: {
            indicator: t.indicatorStyle,
            value: t.valueStyle,
            stacked: t.stacked,
          },
        }))}
        value={templateId}
        fallbackStyle={fallbackStyle}
        fallbackPair={{
          indicator: styles.indicator,
          value: styles.value,
          stacked: template.stacked,
        }}
        onChange={(id) => {
          const tid = isListicleTemplateId(id)
            ? id
            : DEFAULT_LISTICLE_TEMPLATE_ID;
          const kept =
            overrides.y != null ? { y: overrides.y } : undefined;
          patchListicleStyle({
            templateId: tid,
            overrides: kept,
          });
        }}
        previewVariant="static"
      />
    </div>
  );
}
