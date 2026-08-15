import { useRef } from "react";

import { BROLL_DRAG_MIME } from "~/domain/broll";
import { BrollThumb } from "~/editor/components/assets/BrollThumb";
import { cn } from "~/lib/utils";

import type { BrollDragPayload } from "~/domain/broll";
import type { EditorAsset } from "~/editor/store";

export function BrollTile({
  asset,
  onPreview,
}: {
  asset: EditorAsset;
  onPreview?: () => void;
}) {
  const label = asset.originalFilename ?? asset.id.slice(0, 8);
  const draggedRef = useRef(false);
  const canDrag =
    (asset.kind === "image" || asset.kind === "video") &&
    asset.width != null &&
    asset.height != null &&
    asset.width > 0 &&
    asset.height > 0;

  return (
    <div
      className={cn(
        "border-border bg-panel-2 overflow-hidden rounded-lg border select-none",
        canDrag && "cursor-grab active:cursor-grabbing",
        asset.kind === "video" && onPreview && "cursor-pointer",
      )}
      draggable={canDrag}
      onMouseDown={() => {
        draggedRef.current = false;
      }}
      onDragStart={(e) => {
        if (!canDrag) return;
        draggedRef.current = true;
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
      onClick={() => {
        if (draggedRef.current) return;
        if (asset.kind !== "video") return;
        onPreview?.();
      }}
      title={
        asset.durationSec != null
          ? `${label} (${asset.durationSec.toFixed(1)}s)`
          : label
      }
    >
      <BrollThumb asset={asset} />
      <span className="text-muted-foreground block truncate px-1.5 py-1 text-[10px]">
        {label}
      </span>
    </div>
  );
}
