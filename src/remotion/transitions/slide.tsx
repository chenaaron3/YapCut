import type { CSSProperties } from "react";
import { Easing, useCurrentFrame } from "remotion";

import type { TransitionClipProp } from "~/remotion/helpers/types";
import { clipProgress } from "~/remotion/transitions/progress";
import { StitchOverlay } from "~/remotion/transitions/stitch-overlay";
import type { TransitionPainter } from "~/remotion/transitions/types";

const HIDDEN: CSSProperties = { backfaceVisibility: "hidden" };
const EASE = Easing.inOut(Easing.cubic);

function SlideOverlay({ clip }: { clip: TransitionClipProp }) {
  const frame = useCurrentFrame();
  if (clip.mode !== "interior") return null;
  const duration = Math.max(1, clip.endFrame - clip.startFrame);
  const p = clipProgress(frame, duration, EASE);
  return (
    <StitchOverlay
      clip={clip}
      outStyle={{ ...HIDDEN, transform: `translateX(${-p * 100}%)` }}
      inStyle={{ ...HIDDEN, transform: `translateX(${(1 - p) * 100}%)` }}
    />
  );
}

export const slidePainter: TransitionPainter = {
  ease: EASE,
  pictureStyle: (p, mode) => ({
    ...HIDDEN,
    transform:
      mode === "opening"
        ? `translateX(${(1 - p) * 100}%)`
        : `translateX(${-p * 100}%)`,
  }),
  Overlay: SlideOverlay,
};
