/**
 * Transcript / hint drop policy for transitions.
 * Geometry, place, and keep-op reconcile stay in `transition.ts`.
 */
import { keepCells, type ArollLayoutCell } from "~/domain/arolls";
import type { KeepId, TransitionStitch } from "~/domain/project-config";
import type { GlobalTranscriptWord } from "~/domain/transcript";

const EPS = 0.001;
/** Place-hint: word start near a keep edge. */
export const KEEP_EDGE_SEC = 0.35;

export const OPENING_STITCH: TransitionStitch = { kind: "opening" };
export const CLOSING_STITCH: TransitionStitch = { kind: "closing" };

export type TransitionDrop = {
  globalIndex: number;
  stitch: TransitionStitch;
};

function interiorStitch(
  outKeepId: KeepId,
  inKeepId: KeepId,
): TransitionStitch {
  return { kind: "interior", outKeepId, inKeepId };
}

export function firstWordInKeep(
  words: readonly GlobalTranscriptWord[],
  keep: ArollLayoutCell,
): GlobalTranscriptWord | undefined {
  return words.find(
    (w) =>
      !w.inGap &&
      w.start < keep.timeline.end - EPS &&
      w.end > keep.timeline.start + EPS,
  );
}

export function lastWordInKeep(
  words: readonly GlobalTranscriptWord[],
  keep: ArollLayoutCell,
): GlobalTranscriptWord | undefined {
  let last: GlobalTranscriptWord | undefined;
  for (const w of words) {
    if (w.inGap) continue;
    if (w.start < keep.timeline.end - EPS && w.end > keep.timeline.start + EPS) {
      last = w;
    }
  }
  return last;
}

function endsWithSentencePunctuation(text: string): boolean {
  return /[.?!]+$/.test(text.trim());
}

/**
 * Split *all* projected words (including in-gap) on `.?!` only.
 * Not the pause splitter used for pacing.
 */
function splitWordsByPunctuation(
  words: readonly GlobalTranscriptWord[],
): GlobalTranscriptWord[][] {
  if (words.length === 0) return [];
  const sentences: GlobalTranscriptWord[][] = [];
  let batch: GlobalTranscriptWord[] = [];
  const flush = () => {
    if (batch.length === 0) return;
    sentences.push(batch);
    batch = [];
  };
  for (const word of words) {
    batch.push(word);
    if (endsWithSentencePunctuation(word.text)) flush();
  }
  flush();
  return sentences;
}

function firstSpokenInSentence(
  sentence: readonly GlobalTranscriptWord[],
): GlobalTranscriptWord | undefined {
  return sentence.find((w) => !w.inGap);
}

function isFirstWordOfKeep(
  word: GlobalTranscriptWord,
  words: readonly GlobalTranscriptWord[],
  layout: readonly ArollLayoutCell[],
): boolean {
  if (word.inGap) return false;
  const keeps = keepCells(layout);
  for (const keep of keeps) {
    const first = firstWordInKeep(words, keep);
    if (first && first.globalIndex === word.globalIndex) return true;
  }
  return false;
}

function lastSpokenWord(
  words: readonly GlobalTranscriptWord[],
): GlobalTranscriptWord | undefined {
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i]!;
    if (!w.inGap) return w;
  }
  return undefined;
}

function keepIndexForWord(
  word: GlobalTranscriptWord,
  layout: readonly ArollLayoutCell[],
): number | null {
  const keeps = keepCells(layout);
  for (let i = 0; i < keeps.length; i++) {
    const k = keeps[i]!;
    if (
      word.start < k.timeline.end - EPS &&
      word.end > k.timeline.start + EPS
    ) {
      return i;
    }
  }
  return null;
}

/**
 * Valid transcript drop targets: opening keep, keep-edge punctuated
 * sentence starts, and closing after the last kept word.
 */
export function validTransitionDrops(
  words: readonly GlobalTranscriptWord[],
  layout: readonly ArollLayoutCell[],
): TransitionDrop[] {
  const keeps = keepCells(layout);
  if (keeps.length === 0) return [];
  const byIndex = new Map<number, TransitionDrop>();

  const openingWord = firstWordInKeep(words, keeps[0]!);
  if (openingWord) {
    byIndex.set(openingWord.globalIndex, {
      globalIndex: openingWord.globalIndex,
      stitch: OPENING_STITCH,
    });
  }

  for (const sentence of splitWordsByPunctuation(words)) {
    const spoken = firstSpokenInSentence(sentence);
    if (!spoken) continue;
    if (!isFirstWordOfKeep(spoken, words, layout)) continue;
    const keepIndex = keepIndexForWord(spoken, layout);
    if (keepIndex == null) continue;
    if (keepIndex === 0) {
      byIndex.set(spoken.globalIndex, {
        globalIndex: spoken.globalIndex,
        stitch: OPENING_STITCH,
      });
      continue;
    }
    const outKeep = keeps[keepIndex - 1]!;
    const inKeep = keeps[keepIndex]!;
    byIndex.set(spoken.globalIndex, {
      globalIndex: spoken.globalIndex,
      stitch: interiorStitch(outKeep.id, inKeep.id),
    });
  }

  const last = lastSpokenWord(words);
  if (last && !byIndex.has(last.globalIndex)) {
    byIndex.set(last.globalIndex, {
      globalIndex: last.globalIndex,
      stitch: CLOSING_STITCH,
    });
  }

  return [...byIndex.values()].sort((a, b) => a.globalIndex - b.globalIndex);
}

export function transitionDropForWord(
  globalIndex: number,
  words: readonly GlobalTranscriptWord[],
  layout: readonly ArollLayoutCell[],
): TransitionDrop | null {
  return (
    validTransitionDrops(words, layout).find(
      (d) => d.globalIndex === globalIndex,
    ) ?? null
  );
}

export function isValidTransitionDropWord(
  globalIndex: number,
  words: readonly GlobalTranscriptWord[],
  layout: readonly ArollLayoutCell[],
): boolean {
  return transitionDropForWord(globalIndex, words, layout) != null;
}

/**
 * Stitch from a timeline hint (word start). Rejects mid-keep.
 * Last-keep hints that are not a keep-start map to closing.
 */
export function stitchFromPlaceHint(
  hintSec: number,
  layout: readonly ArollLayoutCell[],
): TransitionStitch | null {
  const keeps = keepCells(layout);
  if (keeps.length === 0) return null;

  for (let i = 0; i < keeps.length; i++) {
    const keep = keeps[i]!;
    if (
      hintSec >= keep.timeline.start - EPS &&
      hintSec < keep.timeline.start + KEEP_EDGE_SEC &&
      hintSec < keep.timeline.end - EPS
    ) {
      if (i === 0) return OPENING_STITCH;
      return interiorStitch(keeps[i - 1]!.id, keep.id);
    }
  }

  const last = keeps[keeps.length - 1]!;
  if (
    hintSec >= last.timeline.start - EPS &&
    hintSec <= last.timeline.end + EPS
  ) {
    return CLOSING_STITCH;
  }

  return null;
}
