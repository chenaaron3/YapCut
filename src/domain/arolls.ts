import { produce } from "immer";

import { expandWordDeleteRange } from "~/domain/keeps";
import { isTextBaseEdit, nextKeepId } from "~/domain/project-config";

import type {
  ArollKeep,
  Edit,
  KeepId,
  ProjectConfig,
} from "~/domain/project-config";
import type { LocalTime, OutputTime, TimelineTime } from "~/domain/time";
import type { GlobalTranscriptWord } from "~/domain/transcript";

const EPS = 0.001;
const MIN_KEEP_SEC = 0.05;

/**
 * Layout cell on the A-roll track (keeps + derived gaps).
 *
 * - `local` — asset-local range
 * - `timeline` — expanded timeline range (gaps count)
 * - `output` — compacted playback range (keeps: real span; gaps: degenerate snap point)
 *
 * Keep cell `id` is the persisted `ArollKeep.id`. Gap cell `id` is negative
 * (derived, not persisted).
 */
export type ArollLayoutCell = {
  kind: "keep" | "gap";
  id: number;
  local: LocalTime;
  timeline: TimelineTime;
  output: OutputTime;
};

/**
 * Keep-identity change from A-roll surgery. Edit kinds that bind to keep ids
 * consume these via {@link registerArollEditPostprocessor} — arolls do not
 * know about those kinds.
 */
export type ArollKeepOp =
  | { type: "split"; id: KeepId; rightId: KeepId }
  | { type: "merge"; dyingId: KeepId; survivorId: KeepId }
  | { type: "remove"; id: KeepId };

export type ArollEditPostprocessor = {
  owns: (edit: Edit) => boolean;
  apply: (input: {
    edits: readonly Edit[];
    ops: readonly ArollKeepOp[];
    layout: readonly ArollLayoutCell[];
  }) => Edit[];
};

const postprocessors: ArollEditPostprocessor[] = [];

export function registerArollEditPostprocessor(
  plugin: ArollEditPostprocessor,
): void {
  if (postprocessors.includes(plugin)) return;
  postprocessors.push(plugin);
}

function ownedByPostprocessor(edit: Edit): boolean {
  return postprocessors.some((p) => p.owns(edit));
}

function splitOwnedEdits(edits: readonly Edit[]): {
  owned: Edit[];
  unowned: Edit[];
} {
  const owned: Edit[] = [];
  const unowned: Edit[] = [];
  for (const edit of edits) {
    if (ownedByPostprocessor(edit)) owned.push(edit);
    else unowned.push(edit);
  }
  return { owned, unowned };
}

/** Range-prune edits the plugins do not own; owned edits pass through. */
function pruneUnownedInTimelineRange(
  edits: readonly Edit[],
  range: TimelineTime,
): Edit[] {
  const { owned, unowned } = splitOwnedEdits(edits);
  return [...pruneEditsInTimelineRange(unowned, range), ...owned];
}

function postprocessEdits(
  edits: readonly Edit[],
  ops: readonly ArollKeepOp[],
  layout: readonly ArollLayoutCell[],
): Edit[] {
  let next = edits as Edit[];
  for (const plugin of postprocessors) {
    next = plugin.apply({ edits: next, ops, layout });
  }
  return next;
}

/** Normalize keeps, then retarget plugin edits. Reorder skips this (no keep-id ops). */
function commitKeepSurgery(
  draft: { arolls: ArollKeep[]; edits: Edit[] },
  assetDurationSec: ReadonlyMap<string, number>,
  options?: {
    extraOps?: readonly ArollKeepOp[];
    edits?: readonly Edit[];
  },
): void {
  const { keeps, ops } = normalizeArolls(draft.arolls);
  draft.arolls = keeps;
  draft.edits = postprocessEdits(
    options?.edits ?? draft.edits,
    [...(options?.extraOps ?? []), ...ops],
    buildArollLayout(draft.arolls, assetDurationSec),
  );
}

/** Normalize keeps: drop empties, merge consecutive same-asset overlaps/abutments. */
export function normalizeArolls(arolls: readonly ArollKeep[]): {
  keeps: ArollKeep[];
  ops: ArollKeepOp[];
} {
  const sorted = [...arolls]
    .filter((k) => k.end > k.start + EPS)
    .map((k) => ({
      id: k.id,
      assetId: k.assetId,
      start: k.start,
      end: k.end,
    }));

  // Preserve stitch order; merge overlaps and abutments on the same asset.
  const merged: ArollKeep[] = [];
  const ops: ArollKeepOp[] = [];
  for (const keep of sorted) {
    const last = merged[merged.length - 1];
    if (last?.assetId === keep.assetId && keep.start <= last.end + EPS) {
      if (keep.id !== last.id) {
        ops.push({
          type: "merge",
          dyingId: keep.id,
          survivorId: last.id,
        });
      }
      last.end = Math.max(last.end, keep.end);
      last.start = Math.min(last.start, keep.start);
    } else {
      merged.push({ ...keep });
    }
  }
  return { keeps: merged, ops };
}

/** Library durations for layout (missing → 0). */
export function durationMapFromAssets(
  assets: readonly { id: string; durationSec: number | null | undefined }[],
): Map<string, number> {
  return new Map(assets.map((a) => [a.id, a.durationSec ?? 0]));
}

/** Keep-derived durations. `lookup` wins when it returns a number. */
export function durationMapFromArolls(
  arolls: readonly ArollKeep[],
  lookup?: (assetId: string) => number | null | undefined,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const keep of arolls) {
    map.set(keep.assetId, lookup?.(keep.assetId) ?? keep.end);
  }
  return map;
}

export function buildArollLayoutFromAssets(
  arolls: readonly ArollKeep[],
  assets: readonly { id: string; durationSec: number | null | undefined }[],
): ArollLayoutCell[] {
  return buildArollLayout(arolls, durationMapFromAssets(assets));
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
  let gapSerial = 0;

  const push = (kind: "keep" | "gap", local: LocalTime, keepId?: number) => {
    const dur = Math.max(0, local.end - local.start);
    if (kind === "gap" && dur <= EPS) return;

    const timeline = { start: timelineCursor, end: timelineCursor + dur };
    const output =
      kind === "keep"
        ? { start: outputCursor, end: outputCursor + dur }
        : { start: outputCursor, end: outputCursor };

    cells.push({
      kind,
      id: kind === "keep" ? keepId! : -++gapSerial,
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

    push(
      "keep",
      {
        assetId: keep.assetId,
        start: keep.start,
        end: keep.end,
      },
      keep.id,
    );
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

/** Keep cells only (gaps dropped). Order is stitch order. */
export function keepCells(
  layout: readonly ArollLayoutCell[],
): ArollLayoutCell[] {
  return layout.filter((c) => c.kind === "keep");
}

export function keepCellById(
  layout: readonly ArollLayoutCell[],
  keepId: KeepId,
): ArollLayoutCell | undefined {
  return layout.find((c) => c.kind === "keep" && c.id === keepId);
}

export function firstKeepCell(
  layout: readonly ArollLayoutCell[],
): ArollLayoutCell | undefined {
  return layout.find((c) => c.kind === "keep");
}

export function lastKeepCell(
  layout: readonly ArollLayoutCell[],
): ArollLayoutCell | undefined {
  const keeps = keepCells(layout);
  return keeps[keeps.length - 1];
}

export function keepsAreAdjacent(
  layout: readonly ArollLayoutCell[],
  outKeepId: KeepId,
  inKeepId: KeepId,
): boolean {
  const keeps = keepCells(layout);
  for (let i = 0; i < keeps.length - 1; i++) {
    if (keeps[i]!.id === outKeepId && keeps[i + 1]!.id === inKeepId) {
      return true;
    }
  }
  return false;
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
  const ops: ArollKeepOp[] = [];
  let nextId = nextKeepId(config.arolls);

  for (const cell of layout) {
    if (cell.kind !== "keep") continue;

    const ts = cell.timeline.start;
    const te = cell.timeline.end;
    if (te <= start + EPS || ts >= end - EPS) {
      nextKeeps.push({
        id: cell.id,
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

    const left =
      localCutStart > cell.local.start + EPS
        ? {
            id: cell.id,
            assetId: cell.local.assetId,
            start: cell.local.start,
            end: localCutStart,
          }
        : null;
    const rightRemnant = localCutEnd < cell.local.end - EPS;
    if (left) nextKeeps.push(left);
    if (rightRemnant) {
      const rightId = left ? nextId++ : cell.id;
      if (left) ops.push({ type: "split", id: cell.id, rightId });
      nextKeeps.push({
        id: rightId,
        assetId: cell.local.assetId,
        start: localCutEnd,
        end: cell.local.end,
      });
    }
    if (!left && !rightRemnant) {
      ops.push({ type: "remove", id: cell.id });
    }
  }

  return produce(config, (draft) => {
    draft.arolls = nextKeeps;
    commitKeepSurgery(draft, assetDurationSec, {
      extraOps: ops,
      edits: pruneUnownedInTimelineRange(draft.edits, { start, end }),
    });
  });
}

/**
 * Delete a spoken span the same way the editor does: expand to the
 * auto-trim margin, then keep-surgery the timeline range.
 */
export function deleteWordSpan(
  config: ProjectConfig,
  span: TimelineTime,
  words: readonly GlobalTranscriptWord[],
  keepRanges: readonly TimelineTime[],
  assetDurationSec: ReadonlyMap<string, number>,
): ProjectConfig {
  return deleteTimelineRange(
    config,
    expandWordDeleteRange(span, words, keepRanges),
    assetDurationSec,
  );
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
  return restoreGap(config, cell.local, assetDurationSec);
}

/** Restore a gap layout cell back into arolls (insert keep). No ripple. */
export function restoreGap(
  config: ProjectConfig,
  gap: LocalTime,
  assetDurationSec?: ReadonlyMap<string, number>,
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
      id: nextKeepId(draft.arolls),
      assetId: gap.assetId,
      start: gap.start,
      end: gap.end,
    });
    const durations = new Map(assetDurationSec);
    for (const keep of draft.arolls) {
      if (!durations.has(keep.assetId)) durations.set(keep.assetId, keep.end);
    }
    commitKeepSurgery(draft, durations);
  });
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
      const nextEnd = Math.max(minEnd, Math.min(maxEnd, target.end + delta));
      if (Math.abs(nextEnd - target.end) < EPS) return;
      target.end = nextEnd;
    }

    commitKeepSurgery(draft, assetDurationSec);
  });
}

/** Unique A-roll asset ids in stitch order (contiguous runs). */
export function arollAssetOrder(arolls: readonly ArollKeep[]): string[] {
  const ids: string[] = [];
  for (const keep of arolls) {
    if (ids[ids.length - 1] !== keep.assetId) ids.push(keep.assetId);
  }
  return ids;
}

function groupArollKeepsByAsset(
  arolls: readonly ArollKeep[],
): { assetId: string; keeps: ArollKeep[] }[] {
  const groups: { assetId: string; keeps: ArollKeep[] }[] = [];
  for (const keep of arolls) {
    const last = groups[groups.length - 1];
    if (last?.assetId === keep.assetId) {
      last.keeps.push({ ...keep });
    } else {
      groups.push({ assetId: keep.assetId, keeps: [{ ...keep }] });
    }
  }
  return groups;
}

/** One A-roll asset’s contiguous run on the expanded timeline. */
export type ArollAssetRun = TimelineTime & { assetId: string };

/** Timeline span of each asset run (keeps + gaps) in layout order. */
export function assetRunTimelineRanges(
  cells: readonly ArollLayoutCell[],
): ArollAssetRun[] {
  const runs: ArollAssetRun[] = [];
  for (const cell of cells) {
    const last = runs[runs.length - 1];
    if (last?.assetId === cell.local.assetId) {
      last.end = cell.timeline.end;
    } else {
      runs.push({
        assetId: cell.local.assetId,
        start: cell.timeline.start,
        end: cell.timeline.end,
      });
    }
  }
  return runs;
}

/** Timeline run for one A-roll asset, or null if absent. */
export function assetRunForAssetId(
  arolls: readonly ArollKeep[],
  assetDurationSec: ReadonlyMap<string, number>,
  assetId: string,
): ArollAssetRun | null {
  const runs = assetRunTimelineRanges(
    buildArollLayout(arolls, assetDurationSec),
  );
  return runs.find((r) => r.assetId === assetId) ?? null;
}

/** True when `timelineSec` falls in the run (end inclusive only on last run). */
export function timelineSecInAssetRun(
  run: ArollAssetRun,
  timelineSec: number,
  options?: { isLastRun?: boolean },
): boolean {
  if (timelineSec < run.start) return false;
  if (options?.isLastRun) return timelineSec <= run.end;
  return timelineSec < run.end;
}

function assetRunAtTimelineSec(
  runs: readonly ArollAssetRun[],
  timelineSec: number,
): ArollAssetRun | null {
  if (runs.length === 0) return null;
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i]!;
    if (
      timelineSecInAssetRun(run, timelineSec, {
        isLastRun: i === runs.length - 1,
      })
    ) {
      return run;
    }
  }
  return null;
}

function moveIndex<T>(list: readonly T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= list.length ||
    to >= list.length
  ) {
    return [...list];
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

/**
 * Move an A-roll asset run from `fromIndex` → `toIndex` (stitch order).
 * Edits whose `start` falls in a run move with that run; `end` (and listicle
 * `middle`) are clamped to the run's new timeline end.
 */
export function reorderArollAssets(
  config: ProjectConfig,
  fromIndex: number,
  toIndex: number,
  assetDurationSec: ReadonlyMap<string, number>,
): ProjectConfig {
  const currentOrder = arollAssetOrder(config.arolls);
  const nextOrder = moveIndex(currentOrder, fromIndex, toIndex);
  if (
    nextOrder.length === 0 ||
    nextOrder.every((id, i) => id === currentOrder[i])
  ) {
    return config;
  }

  const groups = groupArollKeepsByAsset(config.arolls);
  const keepsByAsset = new Map(groups.map((g) => [g.assetId, g.keeps]));
  const nextArolls = nextOrder.flatMap((id) => keepsByAsset.get(id) ?? []);

  const oldLayout = buildArollLayout(config.arolls, assetDurationSec);
  const newLayout = buildArollLayout(nextArolls, assetDurationSec);
  const oldRuns = assetRunTimelineRanges(oldLayout);
  const newRuns = assetRunTimelineRanges(newLayout);
  const newByAsset = new Map(newRuns.map((r) => [r.assetId, r]));

  const nextEdits: Edit[] = [];
  for (const edit of config.edits) {
    if (ownedByPostprocessor(edit)) continue;
    const oldRun = assetRunAtTimelineSec(oldRuns, edit.start);
    if (!oldRun) {
      nextEdits.push(edit);
      continue;
    }
    const newRun = newByAsset.get(oldRun.assetId);
    if (!newRun) {
      nextEdits.push(edit);
      continue;
    }

    const delta = newRun.start - oldRun.start;
    const start = edit.start + delta;
    const end = Math.min(edit.end + delta, newRun.end);
    if (end <= start + EPS) continue;

    if (isTextBaseEdit(edit)) {
      let middle = edit.middle ?? null;
      if (middle != null) {
        middle = Math.min(Math.max(middle + delta, start), end);
      }
      nextEdits.push({ ...edit, start, end, middle });
      continue;
    }

    nextEdits.push({ ...edit, start, end });
  }

  const withOwned = [
    ...nextEdits,
    ...config.edits.filter(ownedByPostprocessor),
  ];

  return produce(config, (draft) => {
    draft.arolls = nextArolls;
    draft.edits = postprocessEdits(withOwned, [], newLayout);
  });
}
