import type { ZoomEdit } from "~/domain/project-config";
import { Handle, TrackLabel, useTrackDrag } from "~/editor/components/timeline/shared";
import { clampRangeEdge } from "~/editor/lib/range";
import { isSelected } from "~/editor/lib/selection";
import { rangeStyle } from "~/editor/lib/timeline-time";
import { useTimelineSnap } from "~/editor/lib/use-timeline-snap";
import { useSelection } from "~/editor/selection-store";
import { useEditor } from "~/editor/store";
import { cn } from "~/lib/utils";

type Props = {
  edits: ZoomEdit[];
  width: number;
};

export function ZoomTrack({ edits, width }: Props) {
  const pxPerSec = useEditor((s) => s.pxPerSec);
  const patchEditRangeById = useEditor((s) => s.patchEditRangeById);
  const selection = useSelection((s) => s.selection);
  const select = useSelection((s) => s.select);
  const snap = useTimelineSnap();
  const { startDrag } = useTrackDrag();

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
              isSelected(selection, "edit", edit.id) &&
                "z-[2] outline outline-2 outline-white",
            )}
            style={{ left, width: w }}
            onClick={(e) => {
              e.stopPropagation();
              select("edit", edit.id, e.metaKey || e.ctrlKey);
            }}
          >
            <Handle
              side="left"
              onMouseDown={(e) => {
                select("edit", edit.id);
                const origin = edit.start;
                const fixedEnd = edit.end;
                const id = edit.id;
                startDrag(e, (dxSec, shiftKey) => {
                  const raw = Math.max(0, origin + dxSec);
                  const snapped = snap(raw, shiftKey, "start");
                  const { start, end } = clampRangeEdge("start", snapped, {
                    start: origin,
                    end: fixedEnd,
                  });
                  patchEditRangeById(id, start, end);
                });
              }}
            />
            {(edit.scale ?? 1.5).toFixed(2)}x
            <Handle
              side="right"
              onMouseDown={(e) => {
                select("edit", edit.id);
                const origin = edit.end;
                const fixedStart = edit.start;
                const id = edit.id;
                startDrag(e, (dxSec, shiftKey) => {
                  const raw = origin + dxSec;
                  const snapped = snap(raw, shiftKey, "end");
                  const { start, end } = clampRangeEdge("end", snapped, {
                    start: fixedStart,
                    end: origin,
                  });
                  patchEditRangeById(id, start, end);
                });
              }}
            />
          </button>
        );
      })}
    </TrackLabel>
  );
}
