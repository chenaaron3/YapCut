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
  const hint =
    masking || running
      ? running
        ? `${maskingLabel} ${Math.round(smooth * 100)}%`
        : maskingLabel
      : null;

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
      {hint ? (
        <p className="text-muted-foreground text-[10px]">{hint}</p>
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
