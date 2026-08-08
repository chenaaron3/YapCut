import type { ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import type { ZoomProp } from "~/remotion/types";

const ORIGIN_X = 0.5;
const ORIGIN_Y = 0.35;

function activeZoom(frame: number, zooms: ZoomProp[]): ZoomProp | null {
  for (const zoom of zooms) {
    if (frame >= zoom.startFrame && frame <= zoom.endFrame) return zoom;
  }
  return null;
}

export function Zoom({
  zooms,
  children,
}: {
  zooms: ZoomProp[];
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  const active = zooms.length > 0 ? activeZoom(frame, zooms) : null;

  let scale = 1;
  if (active) {
    if (active.endFrame <= active.startFrame) {
      scale = active.scale;
    } else {
      scale = interpolate(
        frame,
        [active.startFrame, active.endFrame],
        [1, active.scale],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.inOut(Easing.ease),
        },
      );
    }
  }

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale})`,
        transformOrigin: `${ORIGIN_X * 100}% ${ORIGIN_Y * 100}%`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}
