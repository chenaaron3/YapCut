import { useCallback, useRef } from "react";

import { useSelection } from "~/editor/selection-store";

type DragState = { start: number; end: number };

export function wordIndexFromPoint(
  x: number,
  y: number,
  resolveIndexAtPoint?: (x: number, y: number) => number | null,
): number | null {
  const el = document.elementFromPoint(x, y)?.closest("[data-word-index]");
  if (el) {
    const raw = el.getAttribute("data-word-index");
    if (raw != null) {
      const index = Number(raw);
      if (Number.isFinite(index)) return index;
    }
  }

  return resolveIndexAtPoint?.(x, y) ?? null;
}

function suppressNextClick() {
  const onClickCapture = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.removeEventListener("click", onClickCapture, true);
  };
  window.addEventListener("click", onClickCapture, true);
}

export function useWordDragSelect(
  resolveIndexAtPoint?: (x: number, y: number) => number | null,
) {
  const selectWordRange = useSelection((s) => s.selectWordRange);
  const dragRef = useRef<DragState | null>(null);
  const movedRef = useRef(false);
  const resolveRef = useRef(resolveIndexAtPoint);
  resolveRef.current = resolveIndexAtPoint;

  const applyRange = useCallback(
    (start: number, end: number) => {
      selectWordRange(start, end);
    },
    [selectWordRange],
  );

  const endDrag = useCallback(() => {
    const drag = dragRef.current;
    if (drag && movedRef.current) {
      applyRange(drag.start, drag.end);
      suppressNextClick();
    }
    dragRef.current = null;
    movedRef.current = false;
  }, [applyRange]);

  const onDragStart = useCallback(
    (index: number, e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();

      dragRef.current = { start: index, end: index };
      movedRef.current = false;
      applyRange(index, index);

      const onMove = (ev: MouseEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        const hit = wordIndexFromPoint(
          ev.clientX,
          ev.clientY,
          resolveRef.current,
        );
        if (hit == null || drag.end === hit) return;
        movedRef.current = true;
        dragRef.current = { start: drag.start, end: hit };
        applyRange(drag.start, hit);
      };

      const cleanup = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("keydown", onKey, true);
      };

      const onUp = () => {
        cleanup();
        endDrag();
      };

      const onKey = (ev: KeyboardEvent) => {
        if (ev.key !== "Escape") return;
        ev.preventDefault();
        dragRef.current = null;
        movedRef.current = false;
        cleanup();
        useSelection.getState().clearSelection();
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("keydown", onKey, true);
    },
    [applyRange, endDrag],
  );

  return { onDragStart };
}
