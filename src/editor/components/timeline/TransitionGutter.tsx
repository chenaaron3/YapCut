import { useTrackDrag } from "~/editor/components/timeline/shared";
import { useIsSelected } from "~/editor/lib/use-is-selected";
import { useSelection } from "~/editor/selection-store";
import { useEditor } from "~/editor/store";
import { cn } from "~/lib/utils";

import type { ArollLayoutCell } from "~/domain/arolls";
import { keepsForStitch, resizeTransitionFromEdge } from "~/domain/transition";
import type { TransitionEdit } from "~/domain/project-config";
import type { RangeEdge } from "~/domain/edits";

type Props = {
  layout: ArollLayoutCell[];
  edits: TransitionEdit[];
  width: number;
};

const HAIRLINE_MIN_PX = 10;

export function TransitionGutter({ layout, edits, width }: Props) {
  const isSel = useIsSelected(["edit"]);
  const pxPerSec = useEditor((s) => s.pxPerSec);
  const select = useSelection((s) => s.select);
  const patchEdit = useEditor((s) => s.patchEdit);
  const { startDrag } = useTrackDrag();

  if (edits.length === 0) return null;

  return (
    <div className="relative mb-0.5 h-3">
      <div className="relative h-3" style={{ width }}>
        {edits.map((edit) => {
          const pair = keepsForStitch(edit.stitch, layout);
          const selected = isSel("edit", edit.id);
          if (!pair) return null;
          const { outKeep, inKeep } = pair;
          const kind = edit.stitch.kind;

          const gapStart =
            kind === "interior" ? outKeep.timeline.end : edit.start;
          const gapEnd =
            kind === "interior" ? inKeep.timeline.start : edit.start;
          const gapMid = (gapStart + gapEnd) / 2;
          const centerSec =
            kind === "opening"
              ? inKeep.timeline.start
              : kind === "closing"
                ? outKeep.timeline.end
                : gapMid;
          const gapPx = (gapEnd - gapStart) * pxPerSec;
          const showHairline = kind === "interior" && gapPx >= HAIRLINE_MIN_PX;

          return (
            <div key={edit.id} className="contents">
              {showHairline ? (
                <div
                  className="pointer-events-none absolute top-1/2 h-px -translate-y-1/2 bg-transition/50"
                  style={{
                    left: gapStart * pxPerSec,
                    width: Math.max(1, gapPx),
                  }}
                />
              ) : null}

              {kind !== "closing" ? (
                <Wing
                  leftSec={
                    kind === "opening"
                      ? edit.start
                      : kind === "interior"
                        ? inKeep.timeline.start
                        : edit.start
                  }
                  rightSec={edit.end}
                  pxPerSec={pxPerSec}
                />
              ) : null}
              {kind !== "opening" ? (
                <Wing
                  leftSec={edit.start}
                  rightSec={
                    kind === "closing"
                      ? edit.end
                      : outKeep.timeline.end
                  }
                  pxPerSec={pxPerSec}
                />
              ) : null}

              <button
                data-cell
                type="button"
                title={`${edit.templateId} transition`}
                className="absolute top-1/2 z-[3] flex size-3 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                style={{ left: centerSec * pxPerSec }}
                onClick={(e) => {
                  e.stopPropagation();
                  select("edit", edit.id, e.metaKey || e.ctrlKey);
                }}
              >
                <span
                  className={cn(
                    "block size-1.5 rotate-45 rounded-[1px]",
                    selected ? "bg-transition" : "bg-transition/80",
                    selected && "outline outline-1 outline-white",
                  )}
                />
              </button>

              {selected && kind !== "opening" ? (
                <TipHandle
                  sec={edit.start}
                  pxPerSec={pxPerSec}
                  onMouseDown={(e) => {
                    select("edit", edit.id);
                    dragWing(e, edit, "start", layout, patchEdit, startDrag);
                  }}
                />
              ) : null}
              {selected && kind !== "closing" ? (
                <TipHandle
                  sec={edit.end}
                  pxPerSec={pxPerSec}
                  onMouseDown={(e) => {
                    select("edit", edit.id);
                    dragWing(e, edit, "end", layout, patchEdit, startDrag);
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Wing drag: duration from the stitch, then generic `patchEdit` (not `patchEditRange`). */
function dragWing(
  e: React.MouseEvent,
  edit: TransitionEdit,
  edge: RangeEdge,
  layout: readonly ArollLayoutCell[],
  patchEdit: (
    id: number,
    patch: { durationSec: number; start: number; end: number },
    live?: boolean,
  ) => void,
  startDrag: (
    e: React.MouseEvent,
    onMove: (dxSec: number, shiftKey: boolean) => void,
  ) => void,
) {
  const origin = edge === "start" ? edit.start : edit.end;
  startDrag(e, (dxSec) => {
    const next = resizeTransitionFromEdge(edit, edge, origin + dxSec, layout);
    if (!next) return;
    patchEdit(
      edit.id,
      { durationSec: next.durationSec, start: next.start, end: next.end },
      true,
    );
  });
}

function Wing({
  leftSec,
  rightSec,
  pxPerSec,
}: {
  leftSec: number;
  rightSec: number;
  pxPerSec: number;
}) {
  const w = Math.max(2, (rightSec - leftSec) * pxPerSec);
  return (
    <div
      className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-sm bg-transition/70"
      style={{ left: leftSec * pxPerSec, width: w }}
    />
  );
}

function TipHandle({
  sec,
  pxPerSec,
  onMouseDown,
}: {
  sec: number;
  pxPerSec: number;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  return (
    <span
      data-cell
      role="presentation"
      className="absolute top-0 z-[4] h-3 w-2 -translate-x-1/2 cursor-ew-resize rounded-sm bg-white/80 hover:bg-white"
      style={{ left: sec * pxPerSec }}
      onMouseDown={onMouseDown}
    />
  );
}
