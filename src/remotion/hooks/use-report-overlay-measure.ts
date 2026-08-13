import { useLayoutEffect, useRef, type RefObject } from "react";

import { setOverlayMeasure } from "~/remotion/helpers/overlay-measure";

/**
 * Observe the painted overlay border-box and publish it for the player
 * TransformOverlay (via {@link getOverlayMeasure}).
 */
export function useReportOverlayMeasure(
  editId: number,
  enabled: boolean,
  /** Re-attach when layout-affecting content changes. */
  layoutKey: unknown,
): RefObject<HTMLDivElement | null> {
  const boxRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!enabled) return;
    const node = boxRef.current;
    if (!node) {
      setOverlayMeasure(editId, null);
      return;
    }
    const report = () => {
      const width = node.offsetWidth;
      const height = node.offsetHeight;
      if (width < 2 || height < 2) {
        setOverlayMeasure(editId, null);
        return;
      }
      setOverlayMeasure(editId, { width, height });
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(node);
    return () => {
      ro.disconnect();
      setOverlayMeasure(editId, null);
    };
  }, [enabled, editId, layoutKey]);

  return boxRef;
}
