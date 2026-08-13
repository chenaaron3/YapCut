import { useMemo } from "react";

import {
  OVERLAY_PREVIEW_END,
  OVERLAY_PREVIEW_MIDDLE,
  PREVIEW_FPS,
  type OverlayPreviewPair,
} from "~/editor/components/inspector/preview/constants";
import { OVERLAY_TRANSFORM_DEFAULTS } from "~/domain/transform";
import { TextOverlayView } from "~/remotion/components/TextOverlay";
import type { TextOverlayProp } from "~/remotion/helpers/types";

export function OverlayPairPreview({
  pair,
  frame,
}: {
  pair: OverlayPreviewPair;
  frame: number;
}) {
  const overlay = useMemo((): TextOverlayProp => {
    const hasSub = Boolean(pair.subheadingText.trim());
    return {
      id: 0,
      startFrame: 0,
      middleFrame: hasSub && pair.staggered ? OVERLAY_PREVIEW_MIDDLE : null,
      endFrame: OVERLAY_PREVIEW_END,
      heading: pair.headingText,
      subheading: pair.subheadingText,
      headingStyle: pair.heading,
      subheadingStyle: pair.subheading,
      stacked: pair.stacked,
      ...OVERLAY_TRANSFORM_DEFAULTS,
    };
  }, [pair]);

  return (
    <TextOverlayView overlay={overlay} frame={frame} fps={PREVIEW_FPS} />
  );
}
