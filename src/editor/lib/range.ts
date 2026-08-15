export const MIN_RANGE_SEC = 0.05;

/** Move one edge; keep the opposite edge fixed and enforce minimum duration. */
export function clampRangeEdge(
  edge: "start" | "end",
  value: number,
  range: { start: number; end: number },
  minLen = MIN_RANGE_SEC,
): { start: number; end: number } {
  if (edge === "start") {
    const start = Math.min(value, range.end - minLen);
    return { start: Math.max(0, start), end: range.end };
  }
  const end = Math.max(value, range.start + minLen);
  return { start: range.start, end };
}

/** Clamp a range into `[0, max]` with a minimum length. */
export function clampBoundedRange(
  start: number,
  end: number,
  max: number,
  minLen = MIN_RANGE_SEC,
): { start: number; end: number } {
  const limit = Math.max(minLen, max);
  let s = Math.min(Math.max(0, start), limit - minLen);
  let e = Math.min(Math.max(s + minLen, end), limit);
  if (e - s < minLen) {
    e = Math.min(limit, s + minLen);
    s = Math.max(0, e - minLen);
  }
  return { start: s, end: e };
}

/** Slide a range by `delta`, keeping duration and staying inside `[0, max]`. */
export function moveBoundedRange(
  start: number,
  end: number,
  delta: number,
  max: number,
  minLen = MIN_RANGE_SEC,
): { start: number; end: number } {
  const span = Math.max(minLen, end - start);
  const limit = Math.max(minLen, max);
  let s = start + delta;
  if (s < 0) s = 0;
  if (s + span > limit) s = limit - span;
  return { start: s, end: s + span };
}
