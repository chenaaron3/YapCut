import {
  PROCESS_GAP_THRESHOLD_SEC,
  WORD_MARGIN_SEC,
} from "~/domain/editing-constants";
import { PROJECT_FPS } from "~/domain/project-config";

import type { LocalTime, TimelineTime } from "~/domain/time";
import type { GlobalTranscriptWord, TranscriptWord } from "~/domain/transcript";

const EPS = 0.001;

type Interval = { start: number; end: number };

/**
 * Build A-roll keep intervals from local transcript words (long-gap collapse).
 * Collapse long inter-word gaps into A-roll keep intervals (local asset time).
 */
export function buildArollKeepsFromWords(options: {
  words: readonly TranscriptWord[];
  durationSec: number;
  assetId: string;
  fps?: number;
}): LocalTime[] {
  const { words, durationSec, assetId } = options;
  const fps = options.fps ?? PROJECT_FPS;

  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return [{ assetId, start: 0, end: Math.max(0, durationSec) }];
  }

  if (words.length === 0) {
    return [{ assetId, start: 0, end: durationSec }];
  }

  const speechKeep: Interval[] = [];
  const sorted = [...words].sort((a, b) => a.start - b.start);

  let segStart = Math.max(0, sorted[0]!.start - WORD_MARGIN_SEC);

  for (let i = 0; i < sorted.length; i++) {
    const word = sorted[i]!;
    const next = sorted[i + 1];

    if (!next) {
      const segEnd = Math.min(durationSec, word.end + WORD_MARGIN_SEC);
      if (segEnd > segStart) {
        speechKeep.push({ start: segStart, end: segEnd });
      }
      break;
    }

    const gap = next.start - word.end;
    if (gap > PROCESS_GAP_THRESHOLD_SEC) {
      const segEnd = Math.min(durationSec, word.end + WORD_MARGIN_SEC);
      if (segEnd > segStart) {
        speechKeep.push({ start: segStart, end: segEnd });
      }
      segStart = Math.max(0, next.start - WORD_MARGIN_SEC);
    }
  }

  speechKeep.sort((a, b) => a.start - b.start);

  const mergedKeep: Interval[] = [];
  for (const interval of speechKeep) {
    if (interval.end - interval.start < 1 / fps) continue;
    const last = mergedKeep[mergedKeep.length - 1];
    if (last && interval.start <= last.end + 1 / fps) {
      last.end = Math.max(last.end, interval.end);
    } else {
      mergedKeep.push({ ...interval });
    }
  }

  if (mergedKeep.length === 0) {
    mergedKeep.push({ start: 0, end: durationSec });
  }

  return mergedKeep.map((interval) => ({
    assetId,
    start: interval.start,
    end: interval.end,
  }));
}

function rangesOverlap(a: TimelineTime, b: TimelineTime): boolean {
  return a.start < b.end - EPS && a.end > b.start + EPS;
}

function keepAt(
  keeps: readonly TimelineTime[],
  sec: number,
): TimelineTime | undefined {
  return keeps.find((k) => k.start - EPS <= sec && sec <= k.end + EPS);
}

/** Closest remaining word that ends at or before `t` (words are timeline-ordered). */
function nearestWordBefore(
  words: readonly GlobalTranscriptWord[],
  t: number,
): GlobalTranscriptWord | undefined {
  let nearest: GlobalTranscriptWord | undefined;
  for (const w of words) {
    if (w.end > t + EPS) return nearest;
    nearest = w;
  }
  return nearest;
}

/** Closest remaining word that starts at or after `t` (words are timeline-ordered). */
function nearestWordAfter(
  words: readonly GlobalTranscriptWord[],
  t: number,
): GlobalTranscriptWord | undefined {
  for (const w of words) {
    if (w.start >= t - EPS) return w;
  }
  return undefined;
}

/**
 * Expand a word-delete range to the auto-trim margin (`WORD_MARGIN_SEC`).
 *
 * Remaining kept words (not in a gap, not overlapping the cut) are the
 * boundaries: left = prev.end + margin, right = next.start − margin.
 * No remaining word on a side → eat that keep to its edge (whole keep if
 * every word in it is deleted).
 */
export function expandWordDeleteRange(
  range: TimelineTime,
  words: readonly GlobalTranscriptWord[],
  keepRanges: readonly TimelineTime[],
): TimelineTime {
  const start = Math.min(range.start, range.end);
  const end = Math.max(range.start, range.end);
  if (end <= start + EPS || keepRanges.length === 0) return { start, end };

  const leftKeep = keepAt(keepRanges, start);
  const rightKeep = keepAt(keepRanges, Math.max(start, end - EPS));
  if (!leftKeep && !rightKeep) return { start, end };

  const remaining = words.filter(
    (w) => !w.inGap && !rangesOverlap(w, { start, end }),
  );
  const prev = nearestWordBefore(remaining, start);
  const next = nearestWordAfter(remaining, end);

  const cutStart = prev
    ? Math.max(
        leftKeep?.start ?? start,
        Math.min(start, prev.end + WORD_MARGIN_SEC),
      )
    : (leftKeep?.start ?? start);
  const cutEnd = next
    ? Math.min(
        rightKeep?.end ?? end,
        Math.max(end, next.start - WORD_MARGIN_SEC),
      )
    : (rightKeep?.end ?? end);

  return { start: cutStart, end: Math.max(cutStart, cutEnd) };
}
