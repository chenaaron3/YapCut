import { Easing } from "remotion";

/** Extra overlay time holds the last authored frame — never stretched. */
export function playheadSec(
  localSec: number,
  authoredSec: number,
  durationSec: number,
): number {
  if (durationSec < authoredSec && durationSec > 0) {
    return (localSec / durationSec) * authoredSec;
  }
  return Math.min(localSec, authoredSec);
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

/** 0–1 over [start, start+dur], clamped. */
export function span(
  t: number,
  start: number,
  dur: number,
  ease: (u: number) => number = (u) => u,
): number {
  if (dur <= 0) return t >= start ? 1 : 0;
  return ease(clamp01((t - start) / dur));
}

export const easeOutCubic = Easing.out(Easing.cubic);

export function easeBackOut(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}
