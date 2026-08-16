import {
  Handle,
  TrackLabel,
  useEditEdgeDrag,
} from "~/editor/components/timeline/shared";
import { rangeStyle } from "~/editor/lib/timeline-time";
import { useIsSelected } from "~/editor/lib/use-is-selected";
import { useSelection } from "~/editor/selection-store";
import { useEditor } from "~/editor/store";
import { cn } from "~/lib/utils";

import type { ZoomEdit } from "~/domain/project-config";

type Props = {
  edits: ZoomEdit[];
  width: number;
};

export function ZoomTrack({ edits, width }: Props) {
  const isSel = useIsSelected(["edit", "arollAsset"]);
  const pxPerSec = useEditor((s) => s.pxPerSec);
  const select = useSelection((s) => s.select);
  const { onEdgeMouseDown } = useEditEdgeDrag();

  if (edits.length === 0) return null;

  return (
    <TrackLabel label="Zoom" width={width}>
      {edits.map((edit) => {
        const { left, width: w } = rangeStyle(edit.start, edit.end, pxPerSec);
        return (
          <button
            key={edit.id}
            data-cell
            type="button"
            title={`Zoom ${edit.start.toFixed(2)}–${edit.end.toFixed(2)}s · ${(edit.scale ?? 1.5).toFixed(2)}x`}
            className={cn(
              "absolute top-1 bottom-1 flex items-center overflow-hidden rounded bg-purple-500/50 px-1 text-[10px] text-white select-none",
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
            {(edit.scale ?? 1.5).toFixed(2)}x
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
