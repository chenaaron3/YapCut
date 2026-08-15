import {
  firstKeepCell,
  keepCellById,
  keepCells,
  keepsAreAdjacent,
  lastKeepCell,
  registerArollEditPostprocessor,
  type ArollKeepOp,
  type ArollLayoutCell,
} from "~/domain/arolls";
import {
  keepOutputDuration,
  outputToTimelineInKeep,
  timelineToOutputInKeep,
} from "~/domain/layout-time";
import { isListicleEdit } from "~/domain/listicle";
import {
  nextEditId,
  type Edit,
  type KeepId,
  type TransitionEdit,
  type TransitionStitch,
  type TransitionTemplateId,
} from "~/domain/project-config";

import {
  CLOSING_STITCH,
  KEEP_EDGE_SEC,
  OPENING_STITCH,
  firstWordInKeep,
  lastWordInKeep,
  transitionDropForWord,
  validTransitionDrops,
  type TransitionDrop,
} from "~/domain/transition-drops";
import type { TimelineTime } from "~/domain/time";
import type { GlobalTranscriptWord } from "~/domain/transcript";

export type { TransitionDrop, TransitionEdit, TransitionStitch, TransitionTemplateId };
export {
  isValidTransitionDropWord,
  stitchFromPlaceHint,
  transitionDropForWord,
  validTransitionDrops,
} from "~/domain/transition-drops";

/** DataTransfer MIME for drag-from-Assets → transcript place. */
export const TRANSITION_DRAG_MIME = "application/x-transition-template";

/** Output seconds (keep picture only). Interior splits half/half. */
export const TRANSITION_DEFAULT_DURATION_SEC: Record<
  TransitionTemplateId,
  number
> = {
  flash: 0.3,
  flashZoom: 0.3,
  slide: 0.3,
};

export const TRANSITION_MIN_DURATION_SEC = 0.05;
export const TRANSITION_MAX_DURATION_SEC = 2;

const EPS = 0.001;

export type TransitionDragPayload = {
  templateId: TransitionTemplateId;
  label: string;
};

export const TRANSITION_PRESETS: readonly TransitionDragPayload[] = [
  { templateId: "flash", label: "Flash" },
  { templateId: "flashZoom", label: "Flash Zoom" },
  { templateId: "slide", label: "Slide" },
] as const;

export function isTransitionEdit(edit: Edit): edit is TransitionEdit {
  return edit.kind === "transition";
}

export function isTransitionTemplateId(
  value: string,
): value is TransitionTemplateId {
  return value in TRANSITION_DEFAULT_DURATION_SEC;
}

export function transitionSeed(
  templateId: TransitionTemplateId,
  stitch: TransitionStitch,
  durationSec: number = TRANSITION_DEFAULT_DURATION_SEC[templateId],
): Omit<TransitionEdit, "id" | "start" | "end"> {
  return { kind: "transition", templateId, stitch, durationSec };
}

/** Place-time seed from a transcript drop word. Null if the word is not a valid drop. */
export function transitionSeedFromWord(
  templateId: TransitionTemplateId,
  globalIndex: number,
  words: readonly GlobalTranscriptWord[],
  layout: readonly ArollLayoutCell[],
): Omit<TransitionEdit, "id" | "start" | "end"> | null {
  const drop = transitionDropForWord(globalIndex, words, layout);
  if (!drop) return null;
  return transitionSeed(templateId, drop.stitch);
}

export function stitchKey(stitch: TransitionStitch): string {
  if (stitch.kind === "interior") {
    return `interior:${stitch.outKeepId}:${stitch.inKeepId}`;
  }
  return stitch.kind;
}

/** Resolve stitch to the keep cells it paints. Null if the stitch is gone. */
export function keepsForStitch(
  stitch: TransitionStitch,
  layout: readonly ArollLayoutCell[],
): { outKeep: ArollLayoutCell; inKeep: ArollLayoutCell } | null {
  if (stitch.kind === "opening") {
    const keep = firstKeepCell(layout);
    return keep ? { outKeep: keep, inKeep: keep } : null;
  }
  if (stitch.kind === "closing") {
    const keep = lastKeepCell(layout);
    return keep ? { outKeep: keep, inKeep: keep } : null;
  }
  const outKeep = keepCellById(layout, stitch.outKeepId);
  const inKeep = keepCellById(layout, stitch.inKeepId);
  if (!outKeep || !inKeep) return null;
  if (!keepsAreAdjacent(layout, stitch.outKeepId, stitch.inKeepId)) {
    return null;
  }
  return { outKeep, inKeep };
}

function clampDuration(duration: number, max: number): number {
  const hi = Math.max(TRANSITION_MIN_DURATION_SEC, max);
  return Math.min(
    TRANSITION_MAX_DURATION_SEC,
    Math.max(TRANSITION_MIN_DURATION_SEC, Math.min(duration, hi)),
  );
}

export function maxTransitionDuration(
  stitch: TransitionStitch,
  layout: readonly ArollLayoutCell[],
): number {
  const pair = keepsForStitch(stitch, layout);
  if (!pair) return TRANSITION_MIN_DURATION_SEC;
  const { outKeep, inKeep } = pair;
  if (stitch.kind === "opening") {
    return Math.min(TRANSITION_MAX_DURATION_SEC, keepOutputDuration(inKeep));
  }
  if (stitch.kind === "closing") {
    return Math.min(TRANSITION_MAX_DURATION_SEC, keepOutputDuration(outKeep));
  }
  return Math.min(
    TRANSITION_MAX_DURATION_SEC,
    2 * Math.min(keepOutputDuration(outKeep), keepOutputDuration(inKeep)),
  );
}

/**
 * Timeline `{start,end}` for a stitch at an output duration.
 * Interior splits half/half on the two keeps; the gap sits between them.
 */
export function rangeForStitch(
  stitch: TransitionStitch,
  outputDurationSec: number,
  layout: readonly ArollLayoutCell[],
): TimelineTime | null {
  const pair = keepsForStitch(stitch, layout);
  if (!pair) return null;
  const { outKeep, inKeep } = pair;

  const d = clampDuration(
    outputDurationSec,
    maxTransitionDuration(stitch, layout),
  );
  if (d < TRANSITION_MIN_DURATION_SEC - EPS) return null;

  if (stitch.kind === "opening") {
    const start = inKeep.timeline.start;
    const end = outputToTimelineInKeep(inKeep, inKeep.output.start + d);
    if (end <= start + EPS) return null;
    return { start, end };
  }

  if (stitch.kind === "closing") {
    const end = outKeep.timeline.end;
    const start = outputToTimelineInKeep(outKeep, outKeep.output.end - d);
    if (end <= start + EPS) return null;
    return { start, end };
  }

  const half = d / 2;
  const start = outputToTimelineInKeep(outKeep, outKeep.output.end - half);
  const end = outputToTimelineInKeep(inKeep, inKeep.output.start + half);
  if (end <= start + EPS) return null;
  return { start, end };
}

/** Effect duration in output seconds (keep portions only). */
export function transitionOutputDuration(
  edit: Pick<TransitionEdit, "durationSec">,
): number {
  return edit.durationSec;
}

export function transitionAtStitch(
  edits: readonly Edit[],
  stitch: TransitionStitch,
): TransitionEdit | undefined {
  const key = stitchKey(stitch);
  return edits.find(
    (e): e is TransitionEdit =>
      isTransitionEdit(e) && stitchKey(e.stitch) === key,
  );
}

/** True if the stitch is filled or cannot materialize (do not place). */
export function transitionStitchConflicts(
  edits: readonly Edit[],
  stitch: TransitionStitch,
  durationSec: number,
  layout: readonly ArollLayoutCell[],
): boolean {
  if (transitionAtStitch(edits, stitch) != null) return true;
  return rangeForStitch(stitch, durationSec, layout) == null;
}

/** Recompute `{start,end}` (and clamp duration) from stitch. Drop if invalid. */
export function materializeTransition(
  edit: TransitionEdit,
  layout: readonly ArollLayoutCell[],
): TransitionEdit | null {
  const durationSec = clampDuration(
    edit.durationSec,
    maxTransitionDuration(edit.stitch, layout),
  );
  const range = rangeForStitch(edit.stitch, durationSec, layout);
  if (!range) return null;
  return { ...edit, durationSec, start: range.start, end: range.end };
}

function substKeepId(
  id: KeepId,
  role: "out" | "in",
  op: ArollKeepOp,
): KeepId | null {
  if (op.type === "split") {
    if (role === "out" && id === op.id) return op.rightId;
    return id;
  }
  if (op.type === "merge") {
    return id === op.dyingId ? op.survivorId : id;
  }
  return id === op.id ? null : id;
}

function rewriteStitch(
  stitch: TransitionStitch,
  op: ArollKeepOp,
): TransitionStitch | null {
  if (stitch.kind !== "interior") return stitch;
  const outKeepId = substKeepId(stitch.outKeepId, "out", op);
  const inKeepId = substKeepId(stitch.inKeepId, "in", op);
  if (outKeepId == null || inKeepId == null) return null;
  if (outKeepId === inKeepId) return null;
  return { kind: "interior", outKeepId, inKeepId };
}

export function applyKeepRewrites(
  edits: readonly Edit[],
  ops: readonly ArollKeepOp[],
): Edit[] {
  if (ops.length === 0) return edits as Edit[];
  const result: Edit[] = [];
  for (const edit of edits) {
    if (!isTransitionEdit(edit)) {
      result.push(edit);
      continue;
    }
    let stitch: TransitionStitch | null = edit.stitch;
    for (const op of ops) {
      if (!stitch) break;
      stitch = rewriteStitch(stitch, op);
    }
    if (!stitch) continue;
    result.push({ ...edit, stitch });
  }
  return result;
}

/**
 * After keep surgery: rewrite stitch ids, drop invalid, one per stitch,
 * recompute timeline range from duration.
 */
export function reconcileTransitions(
  edits: readonly Edit[],
  layout: readonly ArollLayoutCell[],
  ops: readonly ArollKeepOp[] = [],
): Edit[] {
  const rewritten = applyKeepRewrites(edits, ops);
  const used = new Set<string>();
  const result: Edit[] = [];
  for (const edit of rewritten) {
    if (!isTransitionEdit(edit)) {
      result.push(edit);
      continue;
    }
    const next = materializeTransition(edit, layout);
    if (!next) continue;
    const key = stitchKey(next.stitch);
    if (used.has(key)) continue;
    used.add(key);
    result.push(next);
  }
  return result;
}

function upsertTransition(
  edits: readonly Edit[],
  stitch: TransitionStitch,
  templateId: TransitionTemplateId,
  outputDurationSec: number,
  layout: readonly ArollLayoutCell[],
): { edits: Edit[]; placed: TransitionEdit } | null {
  const durationSec = clampDuration(
    outputDurationSec,
    maxTransitionDuration(stitch, layout),
  );
  const range = rangeForStitch(stitch, durationSec, layout);
  if (!range) return null;
  const existing = transitionAtStitch(edits, stitch);
  if (existing) {
    const placed: TransitionEdit = {
      ...existing,
      templateId,
      durationSec,
      start: range.start,
      end: range.end,
    };
    return {
      edits: edits.map((e) => (e.id === existing.id ? placed : e)),
      placed,
    };
  }
  const placed: TransitionEdit = {
    id: nextEditId(edits),
    kind: "transition",
    templateId,
    durationSec,
    stitch,
    start: range.start,
    end: range.end,
  };
  return { edits: [...edits, placed], placed };
}

/** Place or replace (same stitch) a transition. Replacing keeps duration. */
function placeAtStitch(
  edits: readonly Edit[],
  stitch: TransitionStitch,
  templateId: TransitionTemplateId,
  layout: readonly ArollLayoutCell[],
  outputDurationSec?: number,
): { edits: Edit[]; placed: TransitionEdit } | null {
  const existing = transitionAtStitch(edits, stitch);
  const duration =
    outputDurationSec ??
    existing?.durationSec ??
    TRANSITION_DEFAULT_DURATION_SEC[templateId];
  return upsertTransition(edits, stitch, templateId, duration, layout);
}

export function placeTransitionAtStitch(
  edits: readonly Edit[],
  stitch: TransitionStitch,
  templateId: TransitionTemplateId,
  layout: readonly ArollLayoutCell[],
  outputDurationSec?: number,
): Edit[] {
  return placeAtStitch(edits, stitch, templateId, layout, outputDurationSec)
    ?.edits ?? [...edits];
}

export function resizeTransitionFromDuration(
  edit: TransitionEdit,
  outputDurationSec: number,
  layout: readonly ArollLayoutCell[],
): TransitionEdit | null {
  return materializeTransition(
    { ...edit, durationSec: outputDurationSec },
    layout,
  );
}

/**
 * Symmetric output resize from a dragged timeline edge.
 * Opening: end moves (start pinned). Closing: start moves (end pinned).
 * Interior: either wing sets duration = 2 × that keep's half.
 */
export function resizeTransitionFromEdge(
  edit: TransitionEdit,
  edge: "start" | "end",
  timelineValue: number,
  layout: readonly ArollLayoutCell[],
): TransitionEdit | null {
  const pair = keepsForStitch(edit.stitch, layout);
  if (!pair) return null;
  const { outKeep, inKeep } = pair;

  let duration: number;
  if (edit.stitch.kind === "opening") {
    if (edge === "start") return materializeTransition(edit, layout);
    duration = Math.max(
      TRANSITION_MIN_DURATION_SEC,
      timelineToOutputInKeep(inKeep, timelineValue) - inKeep.output.start,
    );
  } else if (edit.stitch.kind === "closing") {
    if (edge === "end") return materializeTransition(edit, layout);
    duration = Math.max(
      TRANSITION_MIN_DURATION_SEC,
      outKeep.output.end - timelineToOutputInKeep(outKeep, timelineValue),
    );
  } else if (edge === "start") {
    const half = Math.max(
      TRANSITION_MIN_DURATION_SEC / 2,
      outKeep.output.end - timelineToOutputInKeep(outKeep, timelineValue),
    );
    duration = half * 2;
  } else {
    const half = Math.max(
      TRANSITION_MIN_DURATION_SEC / 2,
      timelineToOutputInKeep(inKeep, timelineValue) - inKeep.output.start,
    );
    duration = half * 2;
  }

  return materializeTransition({ ...edit, durationSec: duration }, layout);
}

export function seedOpeningClosingPair(
  edits: readonly Edit[],
  layout: readonly ArollLayoutCell[],
  templateId: TransitionTemplateId = "flash",
): Edit[] {
  const duration = TRANSITION_DEFAULT_DURATION_SEC[templateId];
  const keeps = keepCells(layout);
  if (keeps.length === 0) return [...edits];
  let next = placeTransitionAtStitch(
    edits,
    OPENING_STITCH,
    templateId,
    layout,
    duration,
  );
  next = placeTransitionAtStitch(
    next,
    CLOSING_STITCH,
    templateId,
    layout,
    duration,
  );
  return next;
}

/**
 * Seed flash on listicle headings whose start sits on a valid drop word.
 * Mid-keep listicles: no transition (do not invent a cut).
 */
export function seedListicleTransitions(
  edits: readonly Edit[],
  words: readonly GlobalTranscriptWord[],
  layout: readonly ArollLayoutCell[],
): Edit[] {
  const drops = validTransitionDrops(words, layout);
  let next = [...edits];
  for (const edit of edits) {
    if (!isListicleEdit(edit)) continue;
    const drop = drops.find((d) => {
      const word = words.find((w) => w.globalIndex === d.globalIndex);
      if (!word || word.inGap) return false;
      return (
        Math.abs(word.start - edit.start) < KEEP_EDGE_SEC &&
        d.stitch.kind !== "closing"
      );
    });
    if (!drop) continue;
    next = placeTransitionAtStitch(next, drop.stitch, "flash", layout);
  }
  return next;
}

export function interiorStitchesWithoutTransition(
  edits: readonly Edit[],
  words: readonly GlobalTranscriptWord[],
  layout: readonly ArollLayoutCell[],
): TransitionStitch[] {
  const filled = new Set(
    edits.filter(isTransitionEdit).map((e) => stitchKey(e.stitch)),
  );
  const seen = new Set<string>();
  const out: TransitionStitch[] = [];
  for (const drop of validTransitionDrops(words, layout)) {
    if (drop.stitch.kind !== "interior") continue;
    const key = stitchKey(drop.stitch);
    if (filled.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(drop.stitch);
  }
  return out;
}

export function markerWordForTransition(
  edit: TransitionEdit,
  words: readonly GlobalTranscriptWord[],
  layout: readonly ArollLayoutCell[],
): { globalIndex: number; after: boolean } | null {
  const pair = keepsForStitch(edit.stitch, layout);
  if (!pair) return null;
  if (edit.stitch.kind === "opening") {
    const word = firstWordInKeep(words, pair.inKeep);
    return word ? { globalIndex: word.globalIndex, after: false } : null;
  }
  if (edit.stitch.kind === "closing") {
    const word = lastWordInKeep(words, pair.outKeep);
    return word ? { globalIndex: word.globalIndex, after: true } : null;
  }
  const word = firstWordInKeep(words, pair.inKeep);
  return word ? { globalIndex: word.globalIndex, after: false } : null;
}

registerArollEditPostprocessor({
  owns: isTransitionEdit,
  apply: ({ edits, ops, layout }) =>
    reconcileTransitions(edits, layout, ops),
});

