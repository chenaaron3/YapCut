import { useRef } from "react";
import { Eye, Trash2 } from "lucide-react";

import { BROLL_DRAG_MIME } from "~/domain/edit/broll";
import { BrollThumb } from "~/editor/components/assets/BrollThumb";
import { PickerTile } from "~/editor/components/picker";
import {
  beginAssetPlaceDrag,
  endAssetPlaceDrag,
} from "~/editor/lib/place/asset-place-drag";
import { useSelection } from "~/editor/selection-store";
import { cn } from "~/lib/utils";

import type { BrollDragPayload } from "~/domain/edit/broll";
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
  const select = useSelection((s) => s.select);
  const selected = useSelection((s) =>
    s.selection?.kind === "broll"
      ? s.selection.ids.includes(asset.id)
      : false,
  );
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
      selected={selected}
      fillThumb
      draggable={canDrag}
      className={cn("group", "cursor-pointer")}
      thumbClassName="relative"
      onMouseDown={() => {
        draggedRef.current = false;
      }}
      onDragStart={(e) => {
        if (!canDrag) return;
        if ((e.target as HTMLElement).closest("button")) {
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
        select("broll", asset.id);
      }}
      title={
        asset.durationSec != null
          ? `${label} (${asset.durationSec.toFixed(1)}s)`
          : label
      }
    >
      <BrollThumb asset={asset} />
      {asset.kind === "video" && onPreview ? (
        <button
          type="button"
          className="absolute top-1 left-1 z-10 flex size-5 items-center justify-center rounded bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          title="Preview"
          aria-label={`Preview ${label}`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
        >
          <Eye className="size-3" aria-hidden />
        </button>
      ) : null}
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
