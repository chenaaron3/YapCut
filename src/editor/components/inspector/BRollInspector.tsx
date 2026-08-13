import {
  DEFAULT_KEN_BURNS,
  KEN_BURNS_MAX,
  KEN_BURNS_MIN,
} from "~/domain/broll";
import { transformOf } from "~/domain/transform";
import type { BrollEdit } from "~/domain/project-config";
import { Label } from "~/components/ui/label";
import { SliderField, TransformFields } from "~/editor/components/inspector/field";
import { useEditor } from "~/editor/store";
import { cn } from "~/lib/utils";

const MIN_RANGE_SEC = 0.05;

export function BRollInspector({ edit }: { edit: BrollEdit }) {
  const assets = useEditor((s) => s.assets);
  const patchEdit = useEditor((s) => s.patchEdit);
  const patchMediaRef = useEditor((s) => s.patchMediaRef);

  const asset = assets.find((a) => a.id === edit.assetId);
  const isVideo = asset?.kind === "video";
  const transform = transformOf(edit);
  const mediaOffset = edit.mediaOffsetSec;
  const volume = edit.volume;
  const srcDur = asset?.durationSec ?? null;
  const maxOffset =
    srcDur != null ? Math.max(0, srcDur - MIN_RANGE_SEC) : 0;
  const kenBurnsOn = edit.kenBurns != null;
  const kenBurns = edit.kenBurns ?? DEFAULT_KEN_BURNS;
  const label = asset?.originalFilename ?? edit.assetId.slice(0, 8);

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <p className="truncate text-[11px] text-muted-foreground" title={label}>
        {label}
      </p>

      {isVideo ? (
        <>
          <SliderField
            label="Media offset"
            value={mediaOffset}
            min={0}
            max={maxOffset || 0.001}
            step={0.01}
            display={`${mediaOffset.toFixed(2)}s`}
            onLiveChange={(v) =>
              patchMediaRef(edit.id, { mediaOffsetSec: v }, true)
            }
            onCommit={(v) =>
              patchMediaRef(edit.id, { mediaOffsetSec: v }, true)
            }
          />
          <SliderField
            label="Volume"
            value={volume}
            min={0}
            max={1}
            step={0.01}
            display={`${Math.round(volume * 100)}%`}
            onLiveChange={(v) => patchMediaRef(edit.id, { volume: v }, true)}
            onCommit={(v) => patchMediaRef(edit.id, { volume: v }, true)}
          />
        </>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          className="flex items-center justify-between gap-2 text-left"
          onClick={() =>
            patchEdit(
              edit.id,
              { kenBurns: kenBurnsOn ? null : DEFAULT_KEN_BURNS },
              false,
            )
          }
        >
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Ken Burns
          </Label>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-medium",
              kenBurnsOn
                ? "bg-primary/20 text-primary"
                : "bg-panel-2 text-muted-foreground",
            )}
          >
            {kenBurnsOn ? "On" : "Off"}
          </span>
        </button>

        {kenBurnsOn ? (
          <SliderField
            label="End zoom"
            value={kenBurns}
            min={KEN_BURNS_MIN}
            max={KEN_BURNS_MAX}
            step={0.01}
            display={`${kenBurns.toFixed(2)}×`}
            onLiveChange={(v) => patchEdit(edit.id, { kenBurns: v }, true)}
            onCommit={(v) => patchEdit(edit.id, { kenBurns: v }, true)}
          />
        ) : null}
      </div>

      <TransformFields
        transform={transform}
        onPatch={(partial, live) => patchEdit(edit.id, partial, live)}
      />
    </div>
  );
}
