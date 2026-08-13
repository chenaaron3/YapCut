import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

import type { ShakeClipProp } from "~/remotion/helpers/types";

/**
 * Deterministic “noise” in [-1, 1] from frame + salt (stable across renders).
 */
function shakeSample(frame: number, salt: number): number {
  const x = Math.sin(frame * 12.9898 + salt * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function activeShakeOffset(
  shakes: ShakeClipProp[],
  frame: number,
  width: number,
  height: number,
): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const clip of shakes) {
    if (frame < clip.startFrame || frame >= clip.endFrame) continue;
    const t = frame - clip.startFrame;
    const ampX = clip.intensity * width;
    const ampY = clip.intensity * height;
    // Mix fast jitter with a slower sway so it reads as camera shake.
    x += (shakeSample(t, 1) * 0.65 + Math.sin(t * 1.7) * 0.35) * ampX;
    y += (shakeSample(t, 2) * 0.65 + Math.cos(t * 2.1) * 0.35) * ampY;
  }
  return { x, y };
}

/**
 * Applies active shake VFX to children (A-roll / zoom / b-roll).
 * Captions and on-screen text stay outside so chrome stays readable.
 */
export function ScreenShake({
  shakes,
  children,
}: {
  shakes: ShakeClipProp[];
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { x, y } = activeShakeOffset(shakes, frame, width, height);

  if (shakes.length === 0) {
    return <>{children}</>;
  }

  return (
    <AbsoluteFill
      style={{
        transform: `translate(${x}px, ${y}px)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}
