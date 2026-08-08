import type { SfxEdit } from "~/domain/project-config";
import { Label } from "~/components/ui/label";
import { SliderField } from "~/editor/components/inspector/field";
import { useEditor } from "~/editor/store";

const MIN_RANGE_SEC = 0.05;

export function SfxInspector({ edit }: { edit: SfxEdit }) {
  const assets = useEditor((s) => s.assets);
  const patchEdit = useEditor((s) => s.patchEdit);

  const asset = assets.find((a) => a.id === edit.assetId);
  const label = asset?.originalFilename ?? edit.assetId.slice(0, 8);
  const srcDur = asset?.durationSec ?? null;
  const maxOffset =
    srcDur != null ? Math.max(0, srcDur - MIN_RANGE_SEC) : 0;

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <p className="truncate text-[11px] text-muted-foreground" title={label}>
        {label}
      </p>

      <SliderField
        label="Volume"
        value={edit.volume}
        min={0}
        max={1}
        step={0.01}
        display={`${Math.round(edit.volume * 100)}%`}
        onLiveChange={(v) => patchEdit(edit.id, { volume: v }, true)}
        onCommit={(v) => patchEdit(edit.id, { volume: v }, true)}
      />

      {srcDur != null ? (
        <SliderField
          label="Media offset"
          value={edit.mediaOffsetSec}
          min={0}
          max={maxOffset || 0.001}
          step={0.01}
          display={`${edit.mediaOffsetSec.toFixed(2)}s`}
          onLiveChange={(v) =>
            patchEdit(edit.id, { mediaOffsetSec: v }, true)
          }
          onCommit={(v) => patchEdit(edit.id, { mediaOffsetSec: v }, true)}
        />
      ) : (
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Media offset
          </Label>
          <p className="text-[11px] text-muted-foreground">
            Duration unknown for this asset.
          </p>
        </div>
      )}
    </div>
  );
}
