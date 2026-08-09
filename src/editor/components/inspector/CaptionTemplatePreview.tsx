import { useMemo } from "react";

import {
  captionFocusY,
  type ListiclePreviewPair,
} from "~/editor/components/inspector/preview/constants";
import {
  buildCaptionPreviewGroups,
  CaptionGroupPreview,
  captionPreviewCycle,
} from "~/editor/components/inspector/preview/CaptionGroupPreview";
import {
  LISTICLE_PREVIEW_CYCLE,
  LISTICLE_PREVIEW_IDLE_FRAME,
  ListiclePairPreview,
} from "~/editor/components/inspector/preview/ListiclePairPreview";
import { TemplatePreviewStage } from "~/editor/components/inspector/preview/TemplatePreviewStage";
import { usePreviewFrame } from "~/editor/components/inspector/preview/usePreviewFrame";
import type { CaptionGroupStyle } from "~/remotion/captions/style";

export type { ListiclePreviewPair };

/**
 * Template picker preview — captions/quotes via DynamicGroupView,
 * text VFX via StaticGroupView. Pass `pair` for listicle indicator+value.
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
  /** When set, shows indicator + value placeholders instead of caption phrases. */
  pair?: ListiclePreviewPair | null;
  /** Restart the preview loop when the selected/hovered template changes. */
  restartKey?: string;
}) {
  const groups = useMemo(
    () => (pair ? [] : buildCaptionPreviewGroups(style)),
    [style, pair],
  );
  const { cycleLen, idleFrame } = useMemo(() => {
    if (pair) {
      return {
        cycleLen: LISTICLE_PREVIEW_CYCLE,
        idleFrame: LISTICLE_PREVIEW_IDLE_FRAME,
      };
    }
    return captionPreviewCycle(groups);
  }, [groups, pair]);

  /** Listicle pairs always loop so the stagger reveal is visible. */
  const animating = playing || pair != null;
  const frame = usePreviewFrame(animating, cycleLen, idleFrame, restartKey);
  const displayFrame = animating ? frame : idleFrame;
  const focusY = captionFocusY(pair?.value.y ?? style.y);

  return (
    <TemplatePreviewStage className={className} focusY={focusY}>
      {pair ? (
        <ListiclePairPreview pair={pair} frame={displayFrame} />
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
