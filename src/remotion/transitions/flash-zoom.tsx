import type { CSSProperties } from "react";
import { useCurrentFrame } from "remotion";

import type { TransitionClipProp } from "~/remotion/helpers/types";
import {
  FlashBurst,
  flashPeak01,
  flashPeakFromProgress,
  flashPictureStyle,
} from "~/remotion/transitions/flash";
import { TRANSITION_EASE } from "~/remotion/transitions/progress";
import { StitchOverlay } from "~/remotion/transitions/stitch-overlay";
import type { TransitionPainter } from "~/remotion/transitions/types";

const ORIGIN = "50% 42%";
const PEAK_SCALE = 2.15;
const PEAK_ZOOM_BLUR_PX = 18;

function zoomStyle(peak: number): CSSProperties {
  const scale = 1 + (PEAK_SCALE - 1) * peak;
  return {
    ...flashPictureStyle(peak, PEAK_ZOOM_BLUR_PX * peak),
    transformOrigin: ORIGIN,
    transform: `scale(${scale})`,
  };
}

function FlashZoomOverlay({ clip }: { clip: TransitionClipProp }) {
  const frame = useCurrentFrame();
  const last = Math.max(1, clip.endFrame - clip.startFrame - 1);
  const peak = flashPeak01(frame, last, clip.mode);
  const motion = zoomStyle(peak);
  return (
    <>
      {clip.mode === "interior" ? (
        <StitchOverlay clip={clip} outStyle={motion} inStyle={motion} />
      ) : null}
      <FlashBurst peak={peak} />
    </>
  );
}

export const flashZoomPainter: TransitionPainter = {
  ease: TRANSITION_EASE,
  Overlay: FlashZoomOverlay,
  pictureStyle: (p, mode) => {
    if (mode === "interior") return {};
    return zoomStyle(flashPeakFromProgress(p, mode));
  },
};
