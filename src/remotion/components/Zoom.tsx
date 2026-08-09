import type { ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { TRANSFORM_DEFAULTS } from "~/domain/transform";
import type { ZoomProp } from "~/remotion/types";

const EASE = Easing.inOut(Easing.ease);

function activeZoom(frame: number, zooms: ZoomProp[]): ZoomProp | null {
  for (const zoom of zooms) {
    if (frame >= zoom.startFrame && frame <= zoom.endFrame) return zoom;
  }
  return null;
}

function transformAtFrame(
  frame: number,
  zoom: ZoomProp,
): {
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
} {
  if (!zoom.ease || zoom.endFrame <= zoom.startFrame) {
    return {
      scale: zoom.scale,
      offsetX: zoom.offsetX,
      offsetY: zoom.offsetY,
      rotation: zoom.rotation,
    };
  }

  const input = [zoom.startFrame, zoom.endFrame] as const;
  const opts = {
    extrapolateLeft: "clamp" as const,
    extrapolateRight: "clamp" as const,
    easing: EASE,
  };

  return {
    scale: interpolate(
      frame,
      input,
      [TRANSFORM_DEFAULTS.scale, zoom.scale],
      opts,
    ),
    offsetX: interpolate(
      frame,
      input,
      [TRANSFORM_DEFAULTS.offsetX, zoom.offsetX],
      opts,
    ),
    offsetY: interpolate(
      frame,
      input,
      [TRANSFORM_DEFAULTS.offsetY, zoom.offsetY],
      opts,
    ),
    rotation: interpolate(
      frame,
      input,
      [TRANSFORM_DEFAULTS.rotation, zoom.rotation],
      opts,
    ),
  };
}

export function Zoom({
  zooms,
  children,
}: {
  zooms: ZoomProp[];
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const active = zooms.length > 0 ? activeZoom(frame, zooms) : null;
  const t = active
    ? transformAtFrame(frame, active)
    : TRANSFORM_DEFAULTS;

  return (
    <AbsoluteFill
      style={{
        transform: `translate(${t.offsetX * width}px, ${t.offsetY * height}px) rotate(${t.rotation}deg) scale(${t.scale})`,
        transformOrigin: "center center",
      }}
    >
      {children}
    </AbsoluteFill>
  );
}
