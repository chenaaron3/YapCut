import { arollIndexForKeepCell } from "~/domain/arolls";
import {
  Handle,
  TrackLabel,
  useTrackDrag,
} from "~/editor/components/timeline/shared";
import { VoiceBand } from "~/editor/components/timeline/tracks/VoiceBand";
import { clampRangeEdge } from "~/editor/lib/range";
import { useIsSelected } from "~/editor/lib/use-is-selected";
import { useTimelineSnap } from "~/editor/lib/use-timeline-snap";
import { useSelection } from "~/editor/selection-store";
import { useEditor, useGlobalWords } from "~/editor/store";
import { cn } from "~/lib/utils";

import type { ArollLayoutCell } from "~/domain/arolls";

type Props = {
  layout: ArollLayoutCell[];
  width: number;
};

export function VideoTrack({ layout, width }: Props) {
  const isSel = useIsSelected();
  const pxPerSec = useEditor((s) => s.pxPerSec);
  const seekTimeline = useEditor((s) => s.seekTimeline);
  const patchArollRange = useEditor((s) => s.patchArollRange);
  const words = useGlobalWords();
  const select = useSelection((s) => s.select);
  const snap = useTimelineSnap();
  const { startDrag } = useTrackDrag();

  return (
    <TrackLabel label="Video" width={width}>
      {layout.map((cell) => {
        const localDur = cell.local.end - cell.local.start;
        const selected = isSel("aroll", cell.id);
        const style = {
          left: cell.timeline.start * pxPerSec,
          width: Math.max(
            1,
            (cell.timeline.end - cell.timeline.start) * pxPerSec,
          ),
        };
        if (cell.kind === "keep") {
          const arollIndex = arollIndexForKeepCell(layout, cell.id);
          return (
            <button
              key={cell.id}
              data-cell
              type="button"
              title={`Keep ${localDur.toFixed(2)}s`}
              className={cn(
                "absolute top-1 bottom-1 cursor-pointer overflow-hidden rounded text-[10px] text-[#1a1508] select-none",
                selected
                  ? "z-[2] bg-yellow-400 outline outline-2 outline-white"
                  : "bg-yellow-500/80 hover:bg-yellow-500",
              )}
              style={style}
              onClick={(e) => {
                e.stopPropagation();
                select("aroll", cell.id, e.metaKey || e.ctrlKey);
                seekTimeline(cell.timeline.start);
              }}
            >
              <VoiceBand {...cell.timeline} words={words} />
              {arollIndex != null ? (
                <>
                  <Handle
                    side="left"
                    className="z-20"
                    onMouseDown={(e) => {
                      select("aroll", cell.id);
                      const origin = cell.timeline.start;
                      const fixedEnd = cell.timeline.end;
                      const index = arollIndex;
                      startDrag(e, (dxSec, shiftKey) => {
                        const raw = Math.max(0, origin + dxSec);
                        const snapped = snap(raw, shiftKey, "start");
                        const { start } = clampRangeEdge("start", snapped, {
                          start: origin,
                          end: fixedEnd,
                        });
                        patchArollRange(index, "start", start);
                      });
                    }}
                  />
                  <Handle
                    side="right"
                    className="z-20"
                    onMouseDown={(e) => {
                      select("aroll", cell.id);
                      const origin = cell.timeline.end;
                      const fixedStart = cell.timeline.start;
                      const index = arollIndex;
                      startDrag(e, (dxSec, shiftKey) => {
                        const raw = origin + dxSec;
                        const snapped = snap(raw, shiftKey, "end");
                        const { end } = clampRangeEdge("end", snapped, {
                          start: fixedStart,
                          end: origin,
                        });
                        patchArollRange(index, "end", end);
                      });
                    }}
                  />
                </>
              ) : null}
            </button>
          );
        }
        return (
          <button
            key={cell.id}
            data-cell
            type="button"
            title={`Removed ${localDur.toFixed(2)}s — Delete to restore`}
            className={cn(
              "absolute top-1 bottom-1 z-10 flex items-center justify-center overflow-hidden rounded px-0.5 text-[10px] select-none",
              selected
                ? "z-[2] bg-red-500/80 text-white outline outline-2 outline-white"
                : "bg-red-900/60 text-red-200 hover:bg-red-800/70",
            )}
            style={style}
            onClick={(e) => {
              e.stopPropagation();
              select("aroll", cell.id, e.metaKey || e.ctrlKey);
            }}
          >
            ✂{localDur.toFixed(1)}s
          </button>
        );
      })}
    </TrackLabel>
  );
}
