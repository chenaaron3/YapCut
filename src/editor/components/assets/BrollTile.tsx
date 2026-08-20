import { useRef } from "react";
import { Trash2 } from "lucide-react";

import { BROLL_DRAG_MIME } from "~/domain/broll";
import { BrollThumb } from "~/editor/components/assets/BrollThumb";
import { PickerTile } from "~/editor/components/picker";
import {
  beginAssetPlaceDrag,
  endAssetPlaceDrag,
} from "~/editor/lib/asset-place-drag";
import { cn } from "~/lib/utils";

import type { BrollDragPayload } from "~/domain/broll";
import type { EditorAsset } from "~/editor/store";

export function BrollTile({
  asset,
  onPreview,
  onRemove,
}: {
  asset: EditorAsset;
  onPreview?: () => void;
  onRemove?: () => void;
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
    <PickerTile
      label={label}
      fillThumb
      draggable={canDrag}
      className={cn(
        "group",
        asset.kind === "video" && onPreview && "cursor-pointer",
      )}
      thumbClassName="relative"
      onMouseDown={() => {
        draggedRef.current = false;
      }}
      onDragStart={(e) => {
        if (!canDrag) return;
        if ((e.target as HTMLElement).closest("[data-broll-remove]")) {
          e.preventDefault();
          return;
        }
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
        beginAssetPlaceDrag(e, "broll", "broll", asset);
      }}
      onDragEnd={endAssetPlaceDrag}
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
      {onRemove ? (
        <button
          type="button"
          data-broll-remove
          className="absolute top-1 right-1 z-10 flex size-5 items-center justify-center rounded bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          title="Delete b-roll"
          aria-label={`Delete ${label}`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 className="size-3" aria-hidden />
        </button>
      ) : null}
    </PickerTile>
  );
}
