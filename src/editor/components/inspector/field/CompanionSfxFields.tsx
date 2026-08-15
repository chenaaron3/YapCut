import { useMemo } from "react";

import {
  COMPANION_SFX_VOLUME,
  MIX_SLIDER_MAX,
  SFX_VOLUME_DEFAULT,
  mixSliderOf,
  volumeFromMixSlider,
} from "~/domain/audio/mix-levels";
import { companionSfxRef, formatSfxLabel } from "~/domain/sfx";
import { Label } from "~/components/ui/label";
import { InspectorCollapsible } from "~/editor/components/inspector/field/InspectorCollapsible";
import { SliderField } from "~/editor/components/inspector/field/SliderField";
import { useEditor } from "~/editor/store";

import type { Edit, MediaRef } from "~/domain/project-config";

export function CompanionSfxFields({ edit }: { edit: Edit }) {
  const assets = useEditor((s) => s.assets);
  const patchEdit = useEditor((s) => s.patchEdit);
  const companion = edit.companionSfx;

  const sfxAssets = useMemo(
    () =>
      assets
        .filter((a) => a.audioLibrary === "sfx")
        .slice()
        .sort((a, b) =>
          formatSfxLabel(a.originalFilename, a.id).localeCompare(
            formatSfxLabel(b.originalFilename, a.id),
          ),
        ),
    [assets],
  );

  const setCompanion = (next: MediaRef | null) => {
    patchEdit(edit.id, { companionSfx: next }, false);
  };

  const slider = companion
    ? mixSliderOf(companion.volume, SFX_VOLUME_DEFAULT)
    : mixSliderOf(COMPANION_SFX_VOLUME, SFX_VOLUME_DEFAULT);

  return (
    <InspectorCollapsible title="SFX" defaultOpen={companion != null}>
      <div className="flex flex-col gap-1.5">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Sound
        </Label>
        <select
          className="w-full rounded-md border border-border bg-panel-2 px-2 py-1.5 text-xs text-foreground"
          value={companion?.assetId ?? ""}
          onChange={(e) => {
            const assetId = e.target.value;
            if (!assetId) {
              setCompanion(null);
              return;
            }
            if (companion) {
              setCompanion({ ...companion, assetId });
              return;
            }
            setCompanion(companionSfxRef(assetId));
          }}
        >
          <option value="">None</option>
          {companion && !sfxAssets.some((a) => a.id === companion.assetId) ? (
            <option value={companion.assetId}>
              {companion.assetId.slice(0, 8)}…
            </option>
          ) : null}
          {sfxAssets.map((a) => (
            <option key={a.id} value={a.id}>
              {formatSfxLabel(a.originalFilename, a.id)}
            </option>
          ))}
        </select>
      </div>

      {companion ? (
        <SliderField
          label="Volume"
          value={slider}
          min={0}
          max={MIX_SLIDER_MAX}
          step={0.01}
          display={`${Math.round(slider * 100)}%`}
          onLiveChange={(v) =>
            patchEdit(
              edit.id,
              {
                companionSfx: {
                  ...companion,
                  volume: volumeFromMixSlider(v, SFX_VOLUME_DEFAULT),
                },
              },
              true,
            )
          }
          onCommit={(v) =>
            patchEdit(
              edit.id,
              {
                companionSfx: {
                  ...companion,
                  volume: volumeFromMixSlider(v, SFX_VOLUME_DEFAULT),
                },
              },
              false,
            )
          }
        />
      ) : null}
    </InspectorCollapsible>
  );
}
