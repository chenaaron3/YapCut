import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

import { LABEL_OFFSET } from "~/editor/components/timeline/constants";
import { useEditor } from "~/editor/store";

export function contentXForSec(timelineSec: number, pxPerSec: number): number {
  return LABEL_OFFSET + timelineSec * pxPerSec;
}

/**
 * ⌘/Ctrl + scroll zooms the timeline around the cursor (or playhead),
 * preserving the anchor's viewport position across the pxPerSec change.
 */
export function useTimelineZoom(
  scrollRef: RefObject<HTMLDivElement | null>,
  contentRef: RefObject<HTMLDivElement | null>,
  timelineDuration: number,
) {
  const pxPerSec = useEditor((s) => s.pxPerSec);
  const setPxPerSec = useEditor((s) => s.setPxPerSec);
  const zoomAnchorSec = useRef<number | null>(null);
  const zoomAnchorViewportX = useRef<number | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
      const current = useEditor.getState().pxPerSec;
      const next = Math.min(200, Math.max(8, current * factor));
      if (next === current) return;

      let anchorSec = useEditor.getState().timelineSec;

      const content = contentRef.current;
      if (content && timelineDuration > 0) {
        const rect = content.getBoundingClientRect();
        const x = e.clientX - rect.left - LABEL_OFFSET;
        const underCursor = x / current;
        if (underCursor >= 0 && underCursor <= timelineDuration) {
          anchorSec = underCursor;
        }
      }

      const anchorX = contentXForSec(anchorSec, current);
      zoomAnchorSec.current = anchorSec;
      zoomAnchorViewportX.current = anchorX - el.scrollLeft;
      setPxPerSec(next);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [scrollRef, contentRef, timelineDuration, setPxPerSec]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const anchor = zoomAnchorViewportX.current;
    const sec = zoomAnchorSec.current;
    if (!el || anchor == null || sec == null) return;
    zoomAnchorViewportX.current = null;
    zoomAnchorSec.current = null;

    const { pxPerSec: scale } = useEditor.getState();
    el.scrollLeft = contentXForSec(sec, scale) - anchor;
  }, [pxPerSec, scrollRef]);

  return pxPerSec;
}
