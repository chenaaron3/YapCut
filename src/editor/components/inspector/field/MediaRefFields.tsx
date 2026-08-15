import {
  MIX_SLIDER_MAX,
  MUSIC_VOLUME_DEFAULT,
  SFX_VOLUME_DEFAULT,
  mixSliderOf,
  volumeFromMixSlider,
} from "~/domain/audio/mix-levels";
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
  const roleDefault =
    target === "music" ? MUSIC_VOLUME_DEFAULT : SFX_VOLUME_DEFAULT;
  const slider = mixSliderOf(media.volume, roleDefault);
  const setSlider = (v: number) =>
    patch({ volume: volumeFromMixSlider(v, roleDefault) });

  return (
    <>
      <SliderField
        label="Volume"
        value={slider}
        min={0}
        max={MIX_SLIDER_MAX}
        step={0.01}
        display={`${Math.round(slider * 100)}%`}
        onLiveChange={setSlider}
        onCommit={setSlider}
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
