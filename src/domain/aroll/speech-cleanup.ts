import { deleteWordSpan } from "~/domain/aroll/arolls";
import { isVocalizedPause } from "~/domain/transcript/filler";
import { emptyProjectConfig } from "~/domain/project/project-config";

import type { ArollKeep } from "~/domain/project/project-config";
import type { TimelineTime } from "~/domain/media/time";
import type { GlobalTranscriptWord } from "~/domain/transcript/transcript";

/** Refuse a cleanup that would leave almost no spoken words. */
const MIN_REMAINING_FRACTION = 0.2;
const MIN_REMAINING_WORDS = 3;

export type WordIndexCut = {
  startWordIndex: number;
  endWordIndex: number;
};

/** Clamp, drop invalid / all-gap spans, merge overlapping or adjacent index ranges. */
export function normalizeWordIndexCuts(
  cuts: readonly WordIndexCut[],
  words: readonly GlobalTranscriptWord[],
): WordIndexCut[] {
  if (words.length === 0) return [];

  const last = words.length - 1;
  const valid: WordIndexCut[] = [];
  for (const cut of cuts) {
    const start = Math.max(0, Math.min(cut.startWordIndex, last));
    const end = Math.max(0, Math.min(cut.endWordIndex, last));
    if (end < start) continue;
    let hasSpoken = false;
    for (let i = start; i <= end; i++) {
      if (!words[i]!.inGap) {
        hasSpoken = true;
        break;
      }
    }
    if (!hasSpoken) continue;
    valid.push({ startWordIndex: start, endWordIndex: end });
  }

  valid.sort((a, b) => a.startWordIndex - b.startWordIndex);
  const merged: WordIndexCut[] = [];
  for (const cut of valid) {
    const prev = merged[merged.length - 1];
    if (prev && cut.startWordIndex <= prev.endWordIndex + 1) {
      prev.endWordIndex = Math.max(prev.endWordIndex, cut.endWordIndex);
    } else {
      merged.push({ ...cut });
    }
  }
  return merged;
}

/** Single-word cuts for leftover vocalized pauses (`um` / `uh` / …). */
export function vocalizedPauseCuts(
  words: readonly GlobalTranscriptWord[],
): WordIndexCut[] {
  const cuts: WordIndexCut[] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    if (word.inGap) continue;
    if (isVocalizedPause(word.text)) {
      cuts.push({ startWordIndex: i, endWordIndex: i });
    }
  }
  return cuts;
}

function spokenCountInCuts(
  cuts: readonly WordIndexCut[],
  words: readonly GlobalTranscriptWord[],
): number {
  let count = 0;
  for (const cut of cuts) {
    for (let i = cut.startWordIndex; i <= cut.endWordIndex; i++) {
      if (!words[i]?.inGap) count += 1;
    }
  }
  return count;
}

function cutSpan(
  cut: WordIndexCut,
  words: readonly GlobalTranscriptWord[],
): TimelineTime | null {
  const startWord = words[cut.startWordIndex];
  const endWord = words[cut.endWordIndex];
  if (!startWord || !endWord) return null;
  return { start: startWord.start, end: endWord.end };
}

/**
 * Apply word-index cuts via the same word-delete Model as the editor.
 * Returns the original arolls when the result would be empty or nearly empty.
 */
export function applyWordIndexCuts(
  arolls: readonly ArollKeep[],
  words: readonly GlobalTranscriptWord[],
  durationByAssetId: ReadonlyMap<string, number>,
  cuts: readonly WordIndexCut[],
  keepRanges: readonly TimelineTime[],
): ArollKeep[] {
  const normalized = normalizeWordIndexCuts(cuts, words);
  if (normalized.length === 0) return [...arolls];

  const spokenBefore = words.filter((w) => !w.inGap).length;
  const spokenAfter = spokenBefore - spokenCountInCuts(normalized, words);
  const minKeep = Math.max(
    MIN_REMAINING_WORDS,
    Math.floor(spokenBefore * MIN_REMAINING_FRACTION),
  );
  if (spokenAfter < minKeep) return [...arolls];

  let config = { ...emptyProjectConfig(), arolls: [...arolls] };
  for (const cut of normalized) {
    const span = cutSpan(cut, words);
    if (!span) continue;
    config = deleteWordSpan(config, span, words, keepRanges, durationByAssetId);
  }

  if (config.arolls.length === 0) return [...arolls];
  return config.arolls;
}
