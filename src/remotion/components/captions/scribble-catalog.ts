/**
 * Calm scribble mark catalog (subset).
 * Path data adapted from berkantay/cheez (MIT) — driven by Remotion `evolvePath`,
 * not the original Web Animations API player.
 */
import type { ScribbleId } from "~/domain/scribble";

export type ScribblePlacement = {
  top: string;
  left: string;
  width: string;
  height: string;
};

export type ScribbleStrokeLayer = {
  type: "stroke";
  path: string;
  strokeWidth: number;
  opacity?: number;
  timing: { duration: number; delay?: number };
};

export type ScribbleFillLayer = {
  type: "fill";
  path: string;
  opacity: number;
  reveal: { path: string; strokeWidth: number };
  timing: { duration: number; delay?: number };
};

export type ScribbleLayer = ScribbleStrokeLayer | ScribbleFillLayer;

export type ScribbleDefinition = {
  viewBox: string;
  placement: ScribblePlacement;
  layer: "front" | "behind";
  preserveAspectRatio: "none" | "xMidYMid meet";
  layers: readonly ScribbleLayer[];
};

const UNDERLINE_PLACEMENT: ScribblePlacement = {
  top: "88%",
  left: "-3%",
  width: "106%",
  height: "0.55em",
};

const ENCIRCLE_PLACEMENT: ScribblePlacement = {
  top: "-8%",
  left: "-8%",
  width: "116%",
  height: "122%",
};

const HIGHLIGHT_PLACEMENT: ScribblePlacement = {
  top: "3%",
  left: "-4%",
  width: "108%",
  height: "96%",
};

const OVERWRITE_PLACEMENT: ScribblePlacement = {
  top: "10%",
  left: "-3%",
  width: "106%",
  height: "82%",
};

export const SCRIBBLE_CATALOG: Record<ScribbleId, ScribbleDefinition> = {
  "double-underline": {
    viewBox: "0 0 100 20",
    placement: UNDERLINE_PLACEMENT,
    layer: "front",
    preserveAspectRatio: "none",
    layers: [
      {
        type: "stroke",
        path: "M1 7 C24 5 50 9 99 6",
        strokeWidth: 2.3,
        timing: { duration: 360 },
      },
      {
        type: "stroke",
        path: "M3 14 C30 11 68 16 97 12",
        strokeWidth: 2.3,
        timing: { duration: 360, delay: 105 },
      },
    ],
  },
  "wavy-underline": {
    viewBox: "0 0 100 20",
    placement: UNDERLINE_PLACEMENT,
    layer: "front",
    preserveAspectRatio: "none",
    layers: [
      {
        type: "stroke",
        path: "M0 10 Q8 3 16 10 T32 10 T48 10 T64 10 T80 10 T96 10 T104 10",
        strokeWidth: 2.3,
        timing: { duration: 360 },
      },
    ],
  },
  "double-circle": {
    viewBox: "0 0 100 48",
    placement: ENCIRCLE_PLACEMENT,
    layer: "front",
    preserveAspectRatio: "none",
    layers: [
      {
        type: "stroke",
        path: "M51 3 C78 2 98 10 97 24 C96 40 72 46 45 44 C18 43 2 36 4 21 C6 7 28 4 51 3",
        strokeWidth: 1.8,
        timing: { duration: 360 },
      },
      {
        type: "stroke",
        path: "M56 6 C82 7 96 15 93 29 C89 43 62 45 37 41 C12 37 3 27 9 15 C16 4 35 4 56 6",
        strokeWidth: 1.8,
        timing: { duration: 360, delay: 105 },
      },
    ],
  },
  "corner-box": {
    viewBox: "0 0 100 48",
    placement: ENCIRCLE_PLACEMENT,
    layer: "front",
    preserveAspectRatio: "none",
    layers: [
      {
        type: "stroke",
        path: "M3 16 L3 4 L18 4",
        strokeWidth: 2.3,
        timing: { duration: 360 },
      },
      {
        type: "stroke",
        path: "M82 3 L97 3 L97 16",
        strokeWidth: 2.3,
        timing: { duration: 360, delay: 105 },
      },
      {
        type: "stroke",
        path: "M98 32 L98 44 L82 44",
        strokeWidth: 2.3,
        timing: { duration: 360, delay: 210 },
      },
      {
        type: "stroke",
        path: "M18 45 L3 45 L3 32",
        strokeWidth: 2.3,
        timing: { duration: 360, delay: 315 },
      },
    ],
  },
  bubble: {
    viewBox: "0 0 100 48",
    placement: ENCIRCLE_PLACEMENT,
    layer: "front",
    preserveAspectRatio: "none",
    layers: [
      {
        type: "stroke",
        path: "M16 3 C7 3 3 9 3 18 L3 31 C3 41 12 45 22 45 L43 44 L36 51 L55 44 L82 44 C93 44 98 38 98 29 L97 16 C97 7 88 3 78 3 Z",
        strokeWidth: 2.3,
        timing: { duration: 360 },
      },
    ],
  },
  highlight: {
    viewBox: "0 0 100 30",
    placement: HIGHLIGHT_PLACEMENT,
    layer: "behind",
    preserveAspectRatio: "none",
    layers: [
      {
        type: "fill",
        path: "M1 6 C18 3 38 5 55 4 C72 3 89 5 99 7 L97 25 C78 27 61 25 43 27 C26 28 11 26 2 24 Z",
        opacity: 0.46,
        reveal: {
          path: "M1 16 C24 13 48 16 72 14 C84 13 93 15 100 16",
          strokeWidth: 27,
        },
        timing: { duration: 480 },
      },
    ],
  },
  "strike-through": {
    viewBox: "0 0 100 30",
    placement: OVERWRITE_PLACEMENT,
    layer: "front",
    preserveAspectRatio: "none",
    layers: [
      {
        type: "stroke",
        path: "M0 16 C23 12 61 19 100 14",
        strokeWidth: 2.7,
        timing: { duration: 360 },
      },
    ],
  },
};

function clamp01(n: number): number {
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

/** Authored draw window (ms) — last layer delay + duration. */
export function scribbleAuthoredMs(definition: ScribbleDefinition): number {
  let max = 1;
  for (const layer of definition.layers) {
    max = Math.max(max, (layer.timing.delay ?? 0) + layer.timing.duration);
  }
  return max;
}

/**
 * 0 at the word's first painted frame, 1 at its last (`endFrame` exclusive).
 * One-frame words snap to 1 so the mark is fully drawn.
 */
export function scribbleWordT(
  frame: number,
  startFrame: number,
  endFrame: number,
): number {
  const lastLocal = Math.max(1, endFrame - startFrame) - 1;
  if (lastLocal <= 0) return 1;
  return clamp01((frame - startFrame) / lastLocal);
}

/**
 * Draw-on progress for a layer, compressed into the word when the word is
 * shorter than the authored timing. Longer words play at authored speed, then hold.
 */
export function scribbleLayerProgress(
  wordT: number,
  timing: { duration: number; delay?: number },
  authoredTotalMs: number,
  wordVisibleMs: number,
): number {
  const playThrough =
    wordVisibleMs <= 0 ? 1 : Math.min(1, authoredTotalMs / wordVisibleMs);
  const start = ((timing.delay ?? 0) / authoredTotalMs) * playThrough;
  const end =
    (((timing.delay ?? 0) + timing.duration) / authoredTotalMs) * playThrough;
  return clamp01((wordT - start) / Math.max(end - start, 1e-6));
}
