import { stickerLabel } from "~/domain/edit/sticker";
import {
  Handle,
  TrackLabel,
  useEditEdgeDrag,
} from "~/editor/components/timeline/shared";
import { rangeStyle } from "~/editor/lib/timeline/timeline-time";
import { useIsSelected } from "~/editor/lib/selection/use-is-selected";
import { useSelection } from "~/editor/selection-store";
import { useEditor } from "~/editor/store";
import { cn } from "~/lib/utils";

import type { StickerEdit } from "~/domain/project/project-config";

type Props = {
  edits: StickerEdit[];
  width: number;
};

export function StickerTrack({ edits, width }: Props) {
  const isSel = useIsSelected(["edit", "arollAsset"]);
  const pxPerSec = useEditor((s) => s.pxPerSec);
  const select = useSelection((s) => s.select);
  const { onEdgeMouseDown } = useEditEdgeDrag();

  if (edits.length === 0) return null;

  return (
    <TrackLabel label="Sticker" width={width}>
      {edits.map((edit) => {
        const { left, width: w } = rangeStyle(edit.start, edit.end, pxPerSec);
        const label = stickerLabel(edit);
        return (
          <button
            key={edit.id}
            data-cell
            type="button"
            title={`Sticker ${edit.start.toFixed(2)}–${edit.end.toFixed(2)}s · ${label}`}
            className={cn(
              "bg-sticker/50 absolute top-1 bottom-1 flex items-center overflow-hidden rounded px-1 text-[10px] text-black select-none",
              isSel("edit", edit.id) &&
                "z-[2] outline outline-2 outline-[#F5F9CE]",
            )}
            style={{ left, width: w }}
            onClick={(e) => {
              e.stopPropagation();
              select("edit", edit.id, e.metaKey || e.ctrlKey);
            }}
          >
            <Handle
              side="left"
              onMouseDown={(e) => onEdgeMouseDown(e, edit, "start")}
            />
            <span className="truncate">{label}</span>
            <Handle
              side="right"
              onMouseDown={(e) => onEdgeMouseDown(e, edit, "end")}
            />
          </button>
        );
      })}
    </TrackLabel>
  );
}
