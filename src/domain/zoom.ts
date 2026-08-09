import type { EditSeed } from "~/domain/edits";
import { TRANSFORM_DEFAULTS } from "~/domain/transform";

/** AI / inspector strength → end scale. */
export const ZOOM_STRENGTH = {
  light: 1.05,
  medium: 1.1,
  strong: 1.15,
} as const;

export const DEFAULT_ZOOM_SCALE = ZOOM_STRENGTH.medium;
export const DEFAULT_ZOOM_EASE = false;

export const ZOOM_MIN_DURATION_SEC = 0.8;
export const ZOOM_MAX_DURATION_SEC = 3;
/** Slow push-ins need room to breathe. */
export const ZOOM_EASE_MIN_DURATION_SEC = 1.5;
export const ZOOM_EASE_MAX_DURATION_SEC = 5;

export function resolveZoomEase(ease: boolean | undefined): boolean {
  return ease ?? DEFAULT_ZOOM_EASE;
}

export function isZoomActiveAt(
  edit: { start: number; end: number },
  timelineSec: number,
): boolean {
  return timelineSec >= edit.start && timelineSec < edit.end;
}

/** Place-time defaults (range filled by `placeEdit`). */
export function zoomSeed(): Extract<EditSeed, { kind: "zoom" }> {
  return {
    kind: "zoom",
    scale: DEFAULT_ZOOM_SCALE,
    offsetX: TRANSFORM_DEFAULTS.offsetX,
    offsetY: TRANSFORM_DEFAULTS.offsetY,
    rotation: TRANSFORM_DEFAULTS.rotation,
  };
}
