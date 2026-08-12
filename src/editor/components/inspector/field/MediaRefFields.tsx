import type { MediaRefPatch } from "~/domain/media";
import type { EditId, MediaRef } from "~/domain/project-config";
import { Label } from "~/components/ui/label";
import { SliderField } from "~/editor/components/inspector/field/SliderField";
import { useEditor } from "~/editor/store";

const MIN_RANGE_SEC = 0.05;

export function MediaRefFields({
  media,
  target,
}: {
  media: MediaRef;
  target: "music" | EditId;
}) {
  const assets = useEditor((s) => s.assets);
  const patchMediaRef = useEditor((s) => s.patchMediaRef);
  const srcDur =
    assets.find((a) => a.id === media.assetId)?.durationSec ?? null;
  const maxOffset =
    srcDur != null ? Math.max(0, srcDur - MIN_RANGE_SEC) : 0;

  const patch = (next: MediaRefPatch) => patchMediaRef(target, next, true);

  return (
    <>
      <SliderField
        label="Volume"
        value={media.volume}
        min={0}
        max={1}
        step={0.01}
        display={`${Math.round(media.volume * 100)}%`}
        onLiveChange={(v) => patch({ volume: v })}
        onCommit={(v) => patch({ volume: v })}
      />

      {srcDur == null ? (
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Start offset
          </Label>
          <p className="text-[11px] text-muted-foreground">
            Duration unknown for this asset.
          </p>
        </div>
      ) : maxOffset > 0 ? (
        <SliderField
          label="Start offset"
          value={media.mediaOffsetSec}
          min={0}
          max={maxOffset}
          step={0.01}
          display={`${media.mediaOffsetSec.toFixed(2)}s`}
          onLiveChange={(v) => patch({ mediaOffsetSec: v })}
          onCommit={(v) => patch({ mediaOffsetSec: v })}
        />
      ) : null}
    </>
  );
}
