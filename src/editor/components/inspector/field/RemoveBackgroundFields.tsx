import { Label } from "~/components/ui/label";
import { useAssetMask } from "~/editor/components/inspector/field/use-asset-mask";
import { useMaskProgressStore } from "~/editor/components/inspector/field/use-mask-stream";
import { useSmoothPercent } from "~/lib/use-smooth-percent";
import { cn } from "~/lib/utils";

import type { EditorAsset } from "~/editor/store";
import type { MaskType } from "~/domain/asset/mask";

/** On/off Asset mask (A-roll Separate background, B-roll Remove background). */
export function AssetMaskToggle({
  asset,
  label,
  onMode,
  maskingLabel,
}: {
  asset: EditorAsset;
  label: string;
  onMode: MaskType;
  maskingLabel: string;
}) {
  const { type, isPending, masking, setMask, canSet } = useAssetMask(asset);
  const live = useMaskProgressStore((s) => s.byId[asset.id]);
  const event = live ?? asset.mask?.progress;
  const running = event?.stage === "running";
  const smooth = useSmoothPercent(running ? (event?.progress ?? 0) : 0);
  const on =
    type === onMode || (onMode === "occlude" && type === "cutout");
  const showProgress = masking || running;
  const pct = Math.round(smooth * 100);

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={isPending || !canSet}
        className="flex items-center justify-between gap-2 text-left disabled:opacity-60"
        onClick={() => setMask(on ? null : onMode)}
      >
        <Label className="text-muted-foreground text-[10px] tracking-wider uppercase">
          {label}
        </Label>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-medium",
            on ? "bg-primary/20 text-primary" : "bg-panel-2 text-muted-foreground",
          )}
        >
          {on ? "On" : "Off"}
        </span>
      </button>
      {showProgress ? (
        <div
          className="bg-panel-2 relative h-5 overflow-hidden rounded"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={maskingLabel}
        >
          <div
            className="bg-primary/35 absolute inset-y-0 left-0 transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
          <span className="text-muted-foreground absolute inset-y-0 left-1.5 z-10 flex items-center text-[10px]">
            {maskingLabel}
          </span>
          <span className="text-foreground absolute inset-0 z-10 flex items-center justify-center text-[10px] font-medium tabular-nums">
            {pct}%
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** B-roll library: keep foreground, drop backdrop. */
export function RemoveBackgroundFields({ asset }: { asset: EditorAsset }) {
  return (
    <AssetMaskToggle
      asset={asset}
      label="Remove background"
      onMode="cutout"
      maskingLabel="Removing…"
    />
  );
}
