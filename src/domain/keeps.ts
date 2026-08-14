import {
  PROCESS_GAP_THRESHOLD_SEC,
  WORD_MARGIN_SEC,
} from "~/domain/editing-constants";
import { PROJECT_FPS } from "~/domain/project-config";
import type { LocalTime } from "~/domain/time";

import type { TranscriptWord } from "~/domain/transcript";

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
