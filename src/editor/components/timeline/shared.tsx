import {
  useCallback,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

import type { RangeEdge } from "~/domain/edits";
import { useTimelineSnap } from "~/editor/lib/use-timeline-snap";
import { useSelection } from "~/editor/selection-store";
import { useEditor } from "~/editor/store";
import { cn } from "~/lib/utils";

export function TrackLabel({
  label,
  width,
  children,
}: {
  label: string;
  width: number;
  children: ReactNode;
}) {
  return (
    <div className="relative mb-2 h-11">
      <div className="absolute top-0 left-[-72px] flex h-11 w-16 items-center text-[11px] tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      <div
        className="relative h-11 overflow-hidden rounded-md border border-border bg-panel-2"
        style={{ width }}
      >
        {children}
      </div>
    </div>
  );
}

/** Edge resize grip on a timeline range cell. */
export function Handle({
  side,
  className,
  onMouseDown,
}: {
  side: "left" | "right";
  className?: string;
  onMouseDown: (e: ReactMouseEvent) => void;
}) {
  return (
    <span
      role="presentation"
      className={cn(
        "absolute top-0 bottom-0 z-10 w-2.5 cursor-ew-resize touch-none bg-white/35 hover:bg-white/60",
        side === "left" ? "left-0" : "right-0",
        className,
      )}
      onMouseDown={onMouseDown}
    />
  );
}

function suppressNextClick() {
  const onClickCapture = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.removeEventListener("click", onClickCapture, true);
  };
  window.addEventListener("click", onClickCapture, true);
}

/** Edge-drag helper for timeline range handles (does not move playhead). */
export function useTrackDrag() {
  const beginGesture = useEditor((s) => s.beginGesture);

  const startDrag = useCallback(
    (
      e: ReactMouseEvent,
      onMove: (dxSec: number, shiftKey: boolean) => void,
    ) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      beginGesture();
      const startX = e.clientX;
      const pxPerSec = useEditor.getState().pxPerSec;
      let moved = false;

      const onPointerMove = (ev: MouseEvent) => {
        const dxPx = ev.clientX - startX;
        if (dxPx !== 0) moved = true;
        onMove(dxPx / pxPerSec, ev.shiftKey);
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onPointerMove);
        window.removeEventListener("mouseup", onUp);
        if (moved) suppressNextClick();
      };
      window.addEventListener("mousemove", onPointerMove);
      window.addEventListener("mouseup", onUp);
    },
    [beginGesture],
  );

  return { startDrag };
}

/** Timeline edit handle → `patchEditRange` (domain owns move vs trim). */
export function useEditEdgeDrag() {
  const patchEditRange = useEditor((s) => s.patchEditRange);
  const select = useSelection((s) => s.select);
  const snap = useTimelineSnap();
  const { startDrag } = useTrackDrag();

  const onEdgeMouseDown = useCallback(
    (
      e: ReactMouseEvent,
      edit: { id: number; start: number; end: number },
      edge: RangeEdge,
    ) => {
      select("edit", edit.id);
      const origin = edge === "start" ? edit.start : edit.end;
      const id = edit.id;
      startDrag(e, (dxSec, shiftKey) => {
        const raw =
          edge === "start" ? Math.max(0, origin + dxSec) : origin + dxSec;
        patchEditRange(id, edge, snap(raw, shiftKey, edge));
      });
    },
    [patchEditRange, select, snap, startDrag],
  );

  return { onEdgeMouseDown };
}
