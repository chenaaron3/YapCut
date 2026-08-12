import { useMemo } from "react";

import {
  PREVIEW_FPS,
  type ListiclePreviewPair,
} from "~/editor/components/inspector/preview/constants";
import { ListiclePairView } from "~/remotion/components/ListicleOverlay";
import type { ListicleOverlayProp } from "~/remotion/types";

/** Sample listicle copy for the dual-layer template preview. */
const LISTICLE_PREVIEW_INDICATOR = "01";
const LISTICLE_PREVIEW_VALUE = "The Point";
/** Indicator alone, then value joins/replaces, then brief hold before loop. */
const LISTICLE_PREVIEW_MIDDLE = 28;
const LISTICLE_PREVIEW_END = 70;
export const LISTICLE_PREVIEW_CYCLE = LISTICLE_PREVIEW_END + 12;
export const LISTICLE_PREVIEW_IDLE_FRAME = LISTICLE_PREVIEW_END - 1;

function buildPreviewOverlay(pair: ListiclePreviewPair): ListicleOverlayProp {
  return {
    id: 0,
    startFrame: 0,
    middleFrame: pair.staggered === false ? null : LISTICLE_PREVIEW_MIDDLE,
    endFrame: LISTICLE_PREVIEW_END,
    indicatorText: pair.indicatorText ?? LISTICLE_PREVIEW_INDICATOR,
    valueText: pair.valueText ?? LISTICLE_PREVIEW_VALUE,
    indicatorStyle: pair.indicator,
    valueStyle: pair.value,
    stacked: pair.stacked,
  };
}

/** Staggered indicator + value via the production {@link ListiclePairView}. */
export function ListiclePairPreview({
  pair,
  frame,
}: {
  pair: ListiclePreviewPair;
  frame: number;
}) {
  const overlay = useMemo(() => buildPreviewOverlay(pair), [pair]);

  return (
    <ListiclePairView overlay={overlay} frame={frame} fps={PREVIEW_FPS} />
  );
}
