import { useMemo } from "react";

import {
  captionFocusY,
  overlayFocusY,
  OVERLAY_PREVIEW_CYCLE,
  OVERLAY_PREVIEW_IDLE_FRAME,
  type OverlayPreviewPair,
} from "~/editor/components/inspector/preview/constants";
import {
  buildCaptionPreviewGroups,
  CaptionGroupPreview,
  captionPreviewCycle,
} from "~/editor/components/inspector/preview/CaptionGroupPreview";
import { OverlayPairPreview } from "~/editor/components/inspector/preview/OverlayPairPreview";
import { TemplatePreviewStage } from "~/editor/components/inspector/preview/TemplatePreviewStage";
import { usePreviewFrame } from "~/editor/components/inspector/preview/usePreviewFrame";
import { OVERLAY_TRANSFORM_DEFAULTS } from "~/domain/transform";
import type { CaptionGroupStyle } from "~/remotion/captions/style";

/**
 * Template picker preview — captions/quotes via DynamicGroupView,
 * overlays via TextOverlayView.
 */
export function CaptionTemplatePreview({
  style,
  playing = false,
  className,
  variant = "dynamic",
  pair,
  restartKey = "",
}: {
  style: CaptionGroupStyle;
  playing?: boolean;
  className?: string;
  variant?: "dynamic" | "static";
  pair?: OverlayPreviewPair | null;
  restartKey?: string;
}) {
  const groups = useMemo(
    () => (pair ? [] : buildCaptionPreviewGroups(style)),
    [style, pair],
  );
  const { cycleLen, idleFrame } = useMemo(() => {
    if (pair) {
      return {
        cycleLen: OVERLAY_PREVIEW_CYCLE,
        idleFrame: OVERLAY_PREVIEW_IDLE_FRAME,
      };
    }
    return captionPreviewCycle(groups);
  }, [groups, pair]);

  const animating = playing || pair != null;
  const frame = usePreviewFrame(animating, cycleLen, idleFrame, restartKey);
  const displayFrame = animating ? frame : idleFrame;
  const focusY = pair
    ? overlayFocusY(OVERLAY_TRANSFORM_DEFAULTS.offsetY)
    : captionFocusY(style.y);

  return (
    <TemplatePreviewStage className={className} focusY={focusY}>
      {pair ? (
        <OverlayPairPreview pair={pair} frame={displayFrame} />
      ) : (
        <CaptionGroupPreview
          groups={groups}
          frame={displayFrame}
          variant={variant}
        />
      )}
    </TemplatePreviewStage>
  );
}
