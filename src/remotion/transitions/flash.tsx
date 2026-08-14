import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

import type { TransitionPainter } from "~/remotion/transitions/types";

export const flashPainter: TransitionPainter = {
  Overlay: ({ clip }) => {
    const frame = useCurrentFrame();
    const last = Math.max(1, clip.endFrame - clip.startFrame - 1);
    const mid = last / 2;
    const opacity =
      frame <= mid
        ? interpolate(frame, [0, mid], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        : interpolate(frame, [mid, last], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
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
