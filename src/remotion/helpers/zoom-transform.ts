import { Easing, interpolate } from "remotion";

import { TRANSFORM_DEFAULTS } from "~/domain/edit/transform";

import type { Transform } from "~/domain/edit/transform";
import type { ZoomProp } from "~/remotion/helpers/types";
import type { CSSProperties } from "react";

const EASE = Easing.inOut(Easing.ease);

function activeZoomAtFrame(
  frame: number,
  zooms: readonly ZoomProp[],
): ZoomProp | null {
  for (const zoom of zooms) {
    if (frame >= zoom.startFrame && frame <= zoom.endFrame) return zoom;
  }
  return null;
}

function poseAtFrame(frame: number, zoom: ZoomProp): Transform {
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

/** Active zoom pose at `frame`, or identity when none. Matches {@link Zoom}. */
export function zoomTransformAtFrame(
  frame: number,
  zooms: readonly ZoomProp[],
): Transform {
  const active = zooms.length > 0 ? activeZoomAtFrame(frame, zooms) : null;
  return active ? poseAtFrame(frame, active) : TRANSFORM_DEFAULTS;
}

/** Remotion AbsoluteFill: composition-px `translate` + rotate + scale from center. */
export function zoomLayerCssPx(
  t: Transform,
  width: number,
  height: number,
): CSSProperties {
  return {
    transform: `translate(${t.offsetX * width}px, ${t.offsetY * height}px) rotate(${t.rotation}deg) scale(${t.scale})`,
    transformOrigin: "center center",
  };
}

/**
 * Player overlay sibling of the canvas. Percent translate so it tracks the
 * displayed composition, not 1080×1920 layout px.
 */
export function zoomLayerCssPct(t: Transform): CSSProperties {
  return {
    transform: `translate(${t.offsetX * 100}%, ${t.offsetY * 100}%) rotate(${t.rotation}deg) scale(${t.scale})`,
    transformOrigin: "center center",
  };
}

type CompPoint = { x: number; y: number };

/** CSS `translate() rotate() scale()` from center (scale first). */
export function applyZoomPoint(
  point: CompPoint,
  t: Transform,
  width: number,
  height: number,
): CompPoint {
  const cx = width / 2;
  const cy = height / 2;
  const x = (point.x - cx) * t.scale;
  const y = (point.y - cy) * t.scale;
  const rad = (t.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = x * cos - y * sin;
  const ry = x * sin + y * cos;
  return { x: rx + t.offsetX * width + cx, y: ry + t.offsetY * height + cy };
}

/** Inverse of {@link applyZoomPoint} — pointer in Zoom-child local composition px. */
export function invertZoomPoint(
  point: CompPoint,
  t: Transform,
  width: number,
  height: number,
): CompPoint {
  const cx = width / 2;
  const cy = height / 2;
  const x = point.x - cx - t.offsetX * width;
  const y = point.y - cy - t.offsetY * height;
  const rad = (-t.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = x * cos - y * sin;
  const ry = x * sin + y * cos;
  const scale = t.scale === 0 ? 1 : t.scale;
  return { x: rx / scale + cx, y: ry / scale + cy };
}
