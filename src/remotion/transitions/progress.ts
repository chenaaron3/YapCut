import { Easing, interpolate } from "remotion";

type EaseFn = (t: number) => number;

/** Shared clip curve: slow at both ends, fast through the stitch. */
export const TRANSITION_EASE: EaseFn = Easing.inOut(Easing.cubic);

const CLAMP = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

/** 0 at first overlay frame, 1 at last overlay frame. */
export function clipProgress(
  localFrame: number,
  durationFrames: number,
  ease: EaseFn = TRANSITION_EASE,
): number {
  const last = Math.max(1, durationFrames - 1);
  return interpolate(localFrame, [0, last], [0, 1], {
    ...CLAMP,
    easing: ease,
  });
}

/** Open/close progress, or null outside the clip (picture is identity). */
export function openCloseProgress(
  frame: number,
  startFrame: number,
  endFrame: number,
  ease: EaseFn = TRANSITION_EASE,
): number | null {
  if (frame < startFrame || frame >= endFrame) return null;
  const last = Math.max(startFrame, endFrame - 1);
  if (frame >= last) return 1;
  return interpolate(frame, [startFrame, last], [0, 1], {
    ...CLAMP,
    easing: ease,
  });
}
