import { useLayoutEffect, useRef } from "react";

import {
  captionContentBox,
  setCaptionMeasure,
} from "~/remotion/helpers/caption-measure";

import type { RefObject } from "react";

/**
 * Publish the painted caption/quote ink box for the player overlay.
 */
export function useReportCaptionMeasure(
  enabled: boolean,
  layoutKey: unknown,
): RefObject<HTMLDivElement | null> {
  const boxRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!enabled) return;
    const node = boxRef.current;
    if (!node) {
      setCaptionMeasure(null);
      return;
    }
    const report = () => setCaptionMeasure(captionContentBox(node));
    report();
    const ro = new ResizeObserver(report);
    ro.observe(node);
    return () => {
      ro.disconnect();
      setCaptionMeasure(null);
    };
  }, [enabled, layoutKey]);

  return boxRef;
}
