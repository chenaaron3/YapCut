import { useMemo } from "react";

import { captionFocusY } from "~/editor/components/inspector/preview/constants";
import {
  buildCaptionPreviewGroups,
  CaptionGroupPreview,
  captionPreviewCycle,
} from "~/editor/components/inspector/preview/CaptionGroupPreview";
import { TemplatePreviewStage } from "~/editor/components/inspector/preview/TemplatePreviewStage";
import { usePreviewFrame } from "~/editor/components/inspector/preview/usePreviewFrame";
import type { CaptionGroupStyle } from "~/remotion/captions/style";

/** Template picker preview — captions, quotes, and overlays. */
export function CaptionTemplatePreview({
  style,
  playing = false,
  className,
  restartKey = "",
}: {
  style: CaptionGroupStyle;
  playing?: boolean;
  className?: string;
  restartKey?: string;
}) {
  const groups = useMemo(() => buildCaptionPreviewGroups(style), [style]);
  const { cycleLen, idleFrame } = useMemo(
    () => captionPreviewCycle(groups),
    [groups],
  );

  const frame = usePreviewFrame(playing, cycleLen, idleFrame, restartKey);
  const displayFrame = playing ? frame : idleFrame;

  return (
    <TemplatePreviewStage className={className} focusY={captionFocusY(style.y)}>
      <CaptionGroupPreview groups={groups} frame={displayFrame} />
    </TemplatePreviewStage>
  );
}
