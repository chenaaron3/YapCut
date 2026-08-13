import { captionSafeAreaT } from "~/remotion/captions/style";
import {
  COMPOSITION_HEIGHT,
  COMPOSITION_WIDTH,
  SAFE_AREA,
} from "~/remotion/helpers/constants";

import type { BoxStyle } from "~/editor/components/player/transform-overlay";
import type { CaptionMeasure } from "~/remotion/helpers/caption-measure";

export function safeAreaHeightPx(
  compositionHeight = COMPOSITION_HEIGHT,
): number {
  const top = Number.parseFloat(SAFE_AREA.top) / 100;
  const bottom = Number.parseFloat(SAFE_AREA.bottom) / 100;
  return compositionHeight * (1 - top - bottom);
}

export function captionOverlayBox(
  y: number,
  size: CaptionMeasure,
  scale = 1,
): BoxStyle {
  const leftFrac = Number.parseFloat(SAFE_AREA.left) / 100;
  const topFrac = Number.parseFloat(SAFE_AREA.top) / 100;
  const botFrac = Number.parseFloat(SAFE_AREA.bottom) / 100;
  const safeLeft = COMPOSITION_WIDTH * leftFrac;
  const safeTop = COMPOSITION_HEIGHT * topFrac;
  const safeH = COMPOSITION_HEIGHT * (1 - topFrac - botFrac);
  const cx = safeLeft + size.insetX + size.width / 2;
  const cy = safeTop + captionSafeAreaT(y) * safeH;
  return {
    widthPct: (size.width / COMPOSITION_WIDTH) * 100,
    heightPct: (size.height / COMPOSITION_HEIGHT) * 100,
    leftPct: (cx / COMPOSITION_WIDTH) * 100,
    topPct: (cy / COMPOSITION_HEIGHT) * 100,
    transform: `translate(-50%, -50%) scale(${scale})`,
    scale,
    base: { w: size.width, h: size.height },
  };
}
