import type { Transform } from "~/domain/project-config";

export type { Transform };

export const TRANSFORM_DEFAULTS: Transform = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
};

/**
 * Default block pose for title/listicle overlays — upper title band,
 * not frame center. Positive offsetY is down.
 */
export const OVERLAY_TRANSFORM_DEFAULTS: Transform = {
  scale: 1,
  offsetX: 0,
  offsetY: -0.327,
  rotation: 0,
};

export const TRANSFORM_SCALE_MIN = 0.2;
export const TRANSFORM_SCALE_MAX = 3;

const SNAP_PX = 28;

export type SnapGuide = {
  orientation: "x" | "y";
  /** Position in composition pixels. */
  pos: number;
};

export type SnapResult = {
  offsetX: number;
  offsetY: number;
  guides: SnapGuide[];
};

export function resolveTransform(partial: Partial<Transform>): Transform {
  return {
    scale: partial.scale ?? TRANSFORM_DEFAULTS.scale,
    offsetX: partial.offsetX ?? TRANSFORM_DEFAULTS.offsetX,
    offsetY: partial.offsetY ?? TRANSFORM_DEFAULTS.offsetY,
    rotation: partial.rotation ?? TRANSFORM_DEFAULTS.rotation,
  };
}

export function transformOf(t: Transform): Transform {
  return {
    scale: t.scale,
    offsetX: t.offsetX,
    offsetY: t.offsetY,
    rotation: t.rotation,
  };
}

export function clampTransformScale(scale: number): number {
  return Math.min(TRANSFORM_SCALE_MAX, Math.max(TRANSFORM_SCALE_MIN, scale));
}

/** Patch transform fields on any `Transform`-bearing value. */
export function withTransform<T extends Transform>(
  item: T,
  patch: Partial<Transform>,
): T {
  const next = transformOf(item);
  if (patch.scale != null) next.scale = clampTransformScale(patch.scale);
  if (patch.offsetX != null) next.offsetX = patch.offsetX;
  if (patch.offsetY != null) next.offsetY = patch.offsetY;
  if (patch.rotation != null) next.rotation = patch.rotation;
  return { ...item, ...next };
}

/** Contain-fit natural size into composition bounds. */
export function containSize(
  natW: number,
  natH: number,
  compW: number,
  compH: number,
): { w: number; h: number } {
  if (natW <= 0 || natH <= 0) return { w: compW, h: compH };
  const s = Math.min(compW / natW, compH / natH);
  return { w: natW * s, h: natH * s };
}

/**
 * Snap image center offsets so the box aligns to frame center or edges.
 * Offsets are normalized (fraction of composition size, center-origin).
 */
export function snapTransformOffset(args: {
  offsetX: number;
  offsetY: number;
  boxW: number;
  boxH: number;
  scale: number;
  compW: number;
  compH: number;
  thresholdPx?: number;
}): SnapResult {
  const {
    boxW,
    boxH,
    scale,
    compW,
    compH,
    thresholdPx = SNAP_PX,
  } = args;
  let { offsetX, offsetY } = args;
  const guides: SnapGuide[] = [];

  const w = boxW * scale;
  const h = boxH * scale;
  const cx = compW / 2 + offsetX * compW;
  const cy = compH / 2 + offsetY * compH;

  const xTargets: { pos: number; centerAt: number }[] = [
    { pos: compW / 2, centerAt: compW / 2 },
    { pos: 0, centerAt: w / 2 },
    { pos: compW, centerAt: compW - w / 2 },
  ];
  const yTargets: { pos: number; centerAt: number }[] = [
    { pos: compH / 2, centerAt: compH / 2 },
    { pos: 0, centerAt: h / 2 },
    { pos: compH, centerAt: compH - h / 2 },
  ];

  let bestX: { dist: number; offsetX: number; guide: number } | null = null;
  for (const t of xTargets) {
    const dist = Math.abs(cx - t.centerAt);
    if (dist <= thresholdPx && (!bestX || dist < bestX.dist)) {
      bestX = {
        dist,
        offsetX: (t.centerAt - compW / 2) / compW,
        guide: t.pos,
      };
    }
  }
  if (bestX) {
    offsetX = bestX.offsetX;
    guides.push({ orientation: "x", pos: bestX.guide });
  }

  let bestY: { dist: number; offsetY: number; guide: number } | null = null;
  for (const t of yTargets) {
    const dist = Math.abs(cy - t.centerAt);
    if (dist <= thresholdPx && (!bestY || dist < bestY.dist)) {
      bestY = {
        dist,
        offsetY: (t.centerAt - compH / 2) / compH,
        guide: t.pos,
      };
    }
  }
  if (bestY) {
    offsetY = bestY.offsetY;
    guides.push({ orientation: "y", pos: bestY.guide });
  }

  return { offsetX, offsetY, guides };
}

/** Snap scale so the scaled box width or height matches the frame edge. */
export function snapTransformScale(args: {
  scale: number;
  boxW: number;
  boxH: number;
  compW: number;
  compH: number;
  thresholdPx?: number;
}): number {
  const { boxW, boxH, compW, compH, thresholdPx = SNAP_PX } = args;
  const { scale } = args;
  if (boxW <= 0 || boxH <= 0) return scale;

  const candidates = [compW / boxW, compH / boxH, 1];
  let best = scale;
  let bestDist = Infinity;
  for (const c of candidates) {
    const dist = Math.abs(scale * boxW - c * boxW);
    const distH = Math.abs(scale * boxH - c * boxH);
    const d = Math.min(dist, distH);
    if (d <= thresholdPx && d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}
