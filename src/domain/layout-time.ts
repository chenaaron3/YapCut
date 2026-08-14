/**
 * Maps between layout clocks (TimelineTime ↔ OutputTime) given an A-roll layout.
 * Types live in `~/domain/time`; this module is the conversion + clamp/snap.
 */
import type { ArollLayoutCell } from "~/domain/arolls";
import type { ArollKeep } from "~/domain/project-config";
import type { OutputTime, TimelineTime } from "~/domain/time";

const EPS = 0.001;

function keepCells(
  layout: readonly ArollLayoutCell[],
): ArollLayoutCell[] {
  return layout.filter((c) => c.kind === "keep");
}

/** Compacted output duration (sum of keep lengths — Remotion / export). */
export function outputDurationFromArolls(
  arolls: readonly ArollKeep[],
): number {
  return arolls.reduce(
    (sum, keep) => sum + Math.max(0, keep.end - keep.start),
    0,
  );
}

/** Total expanded timeline length (keeps + gaps). */
export function layoutTimelineDuration(
  cells: readonly ArollLayoutCell[],
): number {
  return cells.length === 0 ? 0 : cells[cells.length - 1]!.timeline.end;
}

export function keepOutputDuration(keep: ArollLayoutCell): number {
  return Math.max(0, keep.output.end - keep.output.start);
}

/** Timeline seconds of an output point that must stay inside a keep. */
export function outputToTimelineInKeep(
  keep: ArollLayoutCell,
  outputSec: number,
): number {
  const o = Math.min(
    keep.output.end,
    Math.max(keep.output.start, outputSec),
  );
  return keep.timeline.start + (o - keep.output.start);
}

/** Output seconds of a timeline point that must stay inside a keep. */
export function timelineToOutputInKeep(
  keep: ArollLayoutCell,
  timelineSec: number,
): number {
  const t = Math.min(
    keep.timeline.end,
    Math.max(keep.timeline.start, timelineSec),
  );
  return keep.output.start + (t - keep.timeline.start);
}

/** Map compacted output seconds → timeline seconds. */
export function outputToTimelineSec(
  cells: readonly ArollLayoutCell[],
  outputSec: number,
): number {
  const keeps = keepCells(cells);
  if (keeps.length === 0) return 0;

  for (const cell of keeps) {
    if (outputSec >= cell.output.start && outputSec < cell.output.end) {
      return cell.timeline.start + (outputSec - cell.output.start);
    }
  }

  const last = keeps[keeps.length - 1]!;
  if (outputSec >= last.output.end) return last.timeline.end;

  const first = keeps[0]!;
  if (outputSec <= first.output.start) return first.timeline.start;

  for (const cell of keeps) {
    if (outputSec <= cell.output.start) return cell.timeline.start;
  }
  return last.timeline.end;
}

/**
 * Map timeline seconds → compacted output seconds.
 * Inside a gap, snaps to the attached keep edge (`output` degenerate point).
 */
export function timelineToOutputSec(
  cells: readonly ArollLayoutCell[],
  timelineSec: number,
): number {
  if (cells.length === 0) return 0;

  for (const cell of cells) {
    if (timelineSec >= cell.timeline.start && timelineSec < cell.timeline.end) {
      if (cell.kind === "keep") {
        return cell.output.start + (timelineSec - cell.timeline.start);
      }
      return cell.output.start;
    }
  }

  const last = cells[cells.length - 1]!;
  if (timelineSec >= last.timeline.end) {
    return last.kind === "keep" ? last.output.end : last.output.start;
  }

  return cells[0]!.output.start;
}

/** Timeline start of the first keep cell (0 if none). */
export function firstKeepTimelineSec(
  cells: readonly ArollLayoutCell[],
): number {
  for (const cell of cells) {
    if (cell.kind === "keep") return cell.timeline.start;
  }
  return 0;
}

/** Snap timeline seconds into a keep (for seek). Gaps snap to the attached edge. */
export function snapTimelineSec(
  cells: readonly ArollLayoutCell[],
  timelineSec: number,
): number {
  if (cells.length === 0) return 0;
  const min = firstKeepTimelineSec(cells);
  const t = Math.min(
    Math.max(min, timelineSec),
    layoutTimelineDuration(cells),
  );

  let seenKeep = false;
  for (const cell of cells) {
    if (t >= cell.timeline.start && t < cell.timeline.end) {
      if (cell.kind === "keep") return t;
      // Prefer previous keep end; else next keep start (leading gap).
      return seenKeep ? cell.timeline.start : cell.timeline.end;
    }
    if (cell.kind === "keep") seenKeep = true;
  }
  return t;
}

export function clampTimelineSec(
  cells: readonly ArollLayoutCell[],
  sec: number,
): number {
  const min = firstKeepTimelineSec(cells);
  const dur = layoutTimelineDuration(cells);
  return Math.min(Math.max(min, sec), Math.max(min, dur));
}

/** Map a timeline range to compacted output (for Remotion). */
export function timelineRangeToOutput(
  cells: readonly ArollLayoutCell[],
  range: TimelineTime,
): OutputTime | null {
  const s = timelineToOutputSec(cells, snapTimelineSec(cells, range.start));
  const e = timelineToOutputSec(cells, snapTimelineSec(cells, range.end));
  if (e <= s + EPS) return null;
  return { start: Math.min(s, e), end: Math.max(s, e) };
}
