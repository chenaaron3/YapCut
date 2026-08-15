import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

import type { TransitionPainter } from "~/remotion/transitions/types";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function flashOpacity(
  frame: number,
  last: number,
  mode: "opening" | "closing" | "interior",
): number {
  if (mode === "opening") return interpolate(frame, [0, last], [1, 0], CLAMP);
  if (mode === "closing") return interpolate(frame, [0, last], [0, 1], CLAMP);
  const mid = last / 2;
  return frame <= mid
    ? interpolate(frame, [0, mid], [0, 1], CLAMP)
    : interpolate(frame, [mid, last], [1, 0], CLAMP);
}

export const flashPainter: TransitionPainter = {
  Overlay: ({ clip }) => {
    const frame = useCurrentFrame();
    const last = Math.max(1, clip.endFrame - clip.startFrame - 1);
    const opacity = flashOpacity(frame, last, clip.mode);
    if (opacity <= 0.001) return null;
    return (
      <AbsoluteFill
        style={{
          backgroundColor: "#fff",
          opacity,
          pointerEvents: "none",
        }}
      />
    );
  },
};
