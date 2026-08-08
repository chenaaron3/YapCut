import {
  BROLL_DRAG_MIME,
  type BrollDragPayload,
} from "~/domain/broll";
import { BrollThumb } from "~/editor/components/assets/BrollThumb";
import type { EditorAsset } from "~/editor/store";
import { cn } from "~/lib/utils";

export function BrollTile({ asset }: { asset: EditorAsset }) {
  const label = asset.originalFilename ?? asset.id.slice(0, 8);
  const canDrag =
    (asset.kind === "image" || asset.kind === "video") &&
    asset.width != null &&
    asset.height != null &&
    asset.width > 0 &&
    asset.height > 0;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-panel-2 select-none",
        canDrag && "cursor-grab active:cursor-grabbing",
      )}
      draggable={canDrag}
      onDragStart={(e) => {
        if (!canDrag) return;
        const payload: BrollDragPayload = {
          assetId: asset.id,
          width: asset.width!,
          height: asset.height!,
          durationSec: asset.durationSec,
          label,
          kind: asset.kind as "image" | "video",
        };
        e.dataTransfer.setData(BROLL_DRAG_MIME, JSON.stringify(payload));
        e.dataTransfer.effectAllowed = "copy";
      }}
      title={
        asset.durationSec != null
          ? `${label} (${asset.durationSec.toFixed(1)}s)`
          : label
      }
    >
      <BrollThumb asset={asset} />
      <span className="block truncate px-1.5 py-1 text-[10px] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
