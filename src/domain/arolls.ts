import { produce } from "immer";

import {
  type ArollKeep,
  type Edit,
  type ProjectConfig,
} from "~/domain/project-config";
import type { LocalTime, OutputTime, TimelineTime } from "~/domain/time";

const EPS = 0.001;
const MIN_KEEP_SEC = 0.05;

/**
 * Layout cell on the A-roll track (keeps + derived gaps).
 *
 * - `local` — asset-local range
 * - `timeline` — expanded timeline range (gaps count)
 * - `output` — compacted playback range (keeps: real span; gaps: degenerate snap point)
 *
 * `id` is unique within a layout build (index in result) — selection key.
 */
export type ArollLayoutCell = {
  kind: "keep" | "gap";
  id: number;
  local: LocalTime;
  timeline: TimelineTime;
  output: OutputTime;
};

/** Normalize keeps: drop empties, merge consecutive same-asset overlaps/abutments. */
export function normalizeArolls(arolls: readonly ArollKeep[]): ArollKeep[] {
  const sorted = [...arolls]
    .filter((k) => k.end > k.start + EPS)
    .map((k) => ({
      assetId: k.assetId,
      start: k.start,
      end: k.end,
    }));

  // Preserve stitch order; merge overlaps and abutments on the same asset.
  const merged: ArollKeep[] = [];
  for (const keep of sorted) {
    const last = merged[merged.length - 1];
    if (
      last?.assetId === keep.assetId &&
      keep.start <= last.end + EPS
    ) {
      last.end = Math.max(last.end, keep.end);
      last.start = Math.min(last.start, keep.start);
    } else {
      merged.push({ ...keep });
    }
  }
  return merged;
}

/**
 * Keep + gap cells on the expanded timeline (View + config axis).
 *
 * Invariants:
 * - Keeps for the same asset are contiguous in `arolls` (no A→B→A stitch).
 * - Timeline cells form one sequence: first starts at 0, each `timeline.end`
 *   equals the next `timeline.start`, last end is total duration.
 */
export function buildArollLayout(
  arolls: readonly ArollKeep[],
  assetDurationSec: ReadonlyMap<string, number>,
): ArollLayoutCell[] {
  const cells: ArollLayoutCell[] = [];
  let timelineCursor = 0;
  let outputCursor = 0;
  /** Local media covered so far on the current asset run. */
  let localCursor = 0;

  const push = (kind: "keep" | "gap", local: LocalTime) => {
    const dur = Math.max(0, local.end - local.start);
    if (kind === "gap" && dur <= EPS) return;

    const timeline = { start: timelineCursor, end: timelineCursor + dur };
    const output =
      kind === "keep"
        ? { start: outputCursor, end: outputCursor + dur }
        : { start: outputCursor, end: outputCursor };

    cells.push({
      kind,
      id: cells.length,
      local,
      timeline,
      output,
    });
    timelineCursor += dur;
    if (kind === "keep") outputCursor += dur;
  };

  for (let i = 0; i < arolls.length; i++) {
    const keep = arolls[i]!;
    const prev = arolls[i - 1];
    if (prev?.assetId !== keep.assetId) {
      localCursor = 0;
    }

    // Leading or intervening local gap on this asset.
    if (keep.start > localCursor + EPS) {
      push("gap", {
        assetId: keep.assetId,
        start: localCursor,
        end: keep.start,
      });
    }

    push("keep", {
      assetId: keep.assetId,
      start: keep.start,
      end: keep.end,
    });
    localCursor = keep.end;

    const next = arolls[i + 1];
    if (next?.assetId === keep.assetId) continue;

    // Leaving this asset run — trailing trim to asset duration.
    const duration = assetDurationSec.get(keep.assetId) ?? localCursor;
    if (duration > localCursor + EPS) {
      push("gap", {
        assetId: keep.assetId,
        start: localCursor,
        end: duration,
      });
    }
  }

  return cells;
}

/** Total expanded timeline length (keeps + gaps). */
export function layoutTimelineDuration(
  cells: readonly ArollLayoutCell[],
): number {
  return cells.length === 0 ? 0 : cells[cells.length - 1]!.timeline.end;
}

/** Map compacted output seconds → timeline seconds. */
export function outputToTimelineSec(
  cells: readonly ArollLayoutCell[],
  outputSec: number,
): number {
  const keeps = cells.filter((c) => c.kind === "keep");
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

/**
 * Remove / clamp edits that overlap a timeline range — no shifting (gaps hold time).
 */
export function pruneEditsInTimelineRange(
  edits: readonly Edit[],
  range: TimelineTime,
): Edit[] {
  const start = Math.min(range.start, range.end);
  const end = Math.max(range.start, range.end);
  if (end <= start + EPS) return [...edits];

  const result: Edit[] = [];
  for (const edit of edits) {
    let next = { ...edit };

    if (next.start >= start - EPS && next.end <= end + EPS) {
      continue;
    }

    if (next.start < end && next.end > start) {
      if (next.start >= start && next.start < end) {
        next = { ...next, start: end };
      }
      if (next.end > start && next.end <= end) {
        next = { ...next, end: start };
      }
      if (next.start < start && next.end > end) {
        next = { ...next, end: start };
      }
    }

    if (next.end > next.start + EPS) {
      result.push(next);
    }
  }
  return result;
}

/**
 * Delete media covering a timeline range. Splits/removes arolls; prunes edits
 * in that range without ripple (gap occupies the same timeline span).
 */
export function deleteTimelineRange(
  config: ProjectConfig,
  range: TimelineTime,
  assetDurationSec: ReadonlyMap<string, number>,
): ProjectConfig {
  const start = Math.min(range.start, range.end);
  const end = Math.max(range.start, range.end);
  if (end <= start + EPS) return config;

  const layout = buildArollLayout(config.arolls, assetDurationSec);
  const nextKeeps: ArollKeep[] = [];

  for (const cell of layout) {
    if (cell.kind !== "keep") continue;

    const ts = cell.timeline.start;
    const te = cell.timeline.end;
    if (te <= start + EPS || ts >= end - EPS) {
      nextKeeps.push({
        assetId: cell.local.assetId,
        start: cell.local.start,
        end: cell.local.end,
      });
      continue;
    }

    const cutStart = Math.max(start, ts);
    const cutEnd = Math.min(end, te);
    const localCutStart = cell.local.start + (cutStart - ts);
    const localCutEnd = cell.local.start + (cutEnd - ts);

    if (localCutStart > cell.local.start + EPS) {
      nextKeeps.push({
        assetId: cell.local.assetId,
        start: cell.local.start,
        end: localCutStart,
      });
    }
    if (localCutEnd < cell.local.end - EPS) {
      nextKeeps.push({
        assetId: cell.local.assetId,
        start: localCutEnd,
        end: cell.local.end,
      });
    }
  }

  return produce(config, (draft) => {
    draft.arolls = normalizeArolls(nextKeeps);
    draft.edits = pruneEditsInTimelineRange(draft.edits, { start, end });
  });
}

/**
 * Delete key on an A-roll layout cell: remove a keep, or restore a gap.
 */
export function applyArollCellAction(
  config: ProjectConfig,
  cell: ArollLayoutCell,
  assetDurationSec: ReadonlyMap<string, number>,
): ProjectConfig {
  if (cell.kind === "keep") {
    return deleteTimelineRange(config, cell.timeline, assetDurationSec);
  }
  return restoreGap(config, cell.local);
}

/** Restore a gap layout cell back into arolls (insert keep). No ripple. */
export function restoreGap(
  config: ProjectConfig,
  gap: LocalTime,
): ProjectConfig {
  const duration = Math.max(0, gap.end - gap.start);
  if (duration <= EPS) return config;

  // Insert after the last keep on this asset that ends <= gap.start,
  // or at the start of the first keep that starts >= gap.end.
  let insertIndex = config.arolls.length;

  for (let i = 0; i < config.arolls.length; i++) {
    const keep = config.arolls[i]!;
    if (keep.assetId !== gap.assetId) continue;
    if (keep.end <= gap.start + EPS) {
      insertIndex = i + 1;
    } else if (keep.start >= gap.end - EPS) {
      insertIndex = i;
      break;
    }
  }

  if (!config.arolls.some((k) => k.assetId === gap.assetId)) {
    insertIndex = config.arolls.length;
  }

  return produce(config, (draft) => {
    draft.arolls.splice(insertIndex, 0, {
      assetId: gap.assetId,
      start: gap.start,
      end: gap.end,
    });
    draft.arolls = normalizeArolls(draft.arolls);
  });
}

export function clampTimelineSec(
  cells: readonly ArollLayoutCell[],
  sec: number,
): number {
  const min = firstKeepTimelineSec(cells);
  const dur = layoutTimelineDuration(cells);
  return Math.min(Math.max(min, sec), Math.max(min, dur));
}

/** Index into `config.arolls` for a keep layout cell, or null. */
export function arollIndexForKeepCell(
  cells: readonly ArollLayoutCell[],
  cellId: number,
): number | null {
  let index = -1;
  for (const cell of cells) {
    if (cell.kind !== "keep") continue;
    index++;
    if (cell.id === cellId) return index;
  }
  return null;
}

/** Layout cell id for the keep at `arollIndex`, or null. */
export function keepCellIdForArollIndex(
  cells: readonly ArollLayoutCell[],
  arollIndex: number,
): number | null {
  let index = -1;
  for (const cell of cells) {
    if (cell.kind !== "keep") continue;
    index++;
    if (index === arollIndex) return cell.id;
  }
  return null;
}

/**
 * Move a keep edge to a timeline timestamp (expands/shrinks into adjacent gaps).
 * `arollIndex` is the index in `config.arolls` (stable across layout id shifts).
 */
export function setArollKeepEdge(
  config: ProjectConfig,
  arollIndex: number,
  edge: "start" | "end",
  targetTimelineSec: number,
  assetDurationSec: ReadonlyMap<string, number>,
): ProjectConfig {
  const layout = buildArollLayout(config.arolls, assetDurationSec);
  const cellId = keepCellIdForArollIndex(layout, arollIndex);
  if (cellId == null) return config;
  const cell = layout.find((c) => c.id === cellId);
  if (cell?.kind !== "keep") return config;

  const keep = config.arolls[arollIndex];
  if (!keep) return config;

  const prev = config.arolls[arollIndex - 1];
  const next = config.arolls[arollIndex + 1];
  const prevSame = prev?.assetId === keep.assetId ? prev : null;
  const nextSame = next?.assetId === keep.assetId ? next : null;
  const assetDur = assetDurationSec.get(keep.assetId) ?? keep.end;

  return produce(config, (draft) => {
    const target = draft.arolls[arollIndex];
    if (!target) return;

    if (edge === "start") {
      const delta = targetTimelineSec - cell.timeline.start;
      const minStart = prevSame ? prevSame.end : 0;
      const maxStart = target.end - MIN_KEEP_SEC;
      const nextStart = Math.max(
        minStart,
        Math.min(maxStart, target.start + delta),
      );
      if (Math.abs(nextStart - target.start) < EPS) return;
      target.start = nextStart;
    } else {
      const delta = targetTimelineSec - cell.timeline.end;
      const minEnd = target.start + MIN_KEEP_SEC;
      const maxEnd = nextSame ? nextSame.start : assetDur;
      const nextEnd = Math.max(
        minEnd,
        Math.min(maxEnd, target.end + delta),
      );
      if (Math.abs(nextEnd - target.end) < EPS) return;
      target.end = nextEnd;
    }

    draft.arolls = normalizeArolls(draft.arolls);
  });
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
