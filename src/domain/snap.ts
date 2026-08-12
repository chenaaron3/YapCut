/** Prefer keep edge over first/last word when they are this close. */
export const TRANSCRIPT_KEEP_EDGE_SNAP_SEC = 1;

type Timed = { start: number; end: number; index?: number };

function overlaps(a: Timed, b: { start: number; end: number }): boolean {
  return a.start < b.end - 0.001 && a.end > b.start + 0.001;
}

/**
 * If this is the first/last word in its keep region and the word edge is
 * within threshold of the keep edge, snap to the keep edge.
 */
export function snapTranscriptCaptionEdge(
  caption: Timed,
  edge: "start" | "end",
  captions: Timed[],
  keeps: { start: number; end: number }[],
  thresholdSec = TRANSCRIPT_KEEP_EDGE_SNAP_SEC,
): number {
  const wordSec = edge === "start" ? caption.start : caption.end;
  const keep = keeps.find((k) => overlaps(caption, k));
  if (!keep) return wordSec;

  const inKeep = captions.filter((c) => overlaps(c, keep));
  if (inKeep.length === 0) return wordSec;

  if (edge === "start") {
    const first = inKeep.reduce((a, b) =>
      (a.index ?? a.start) <= (b.index ?? b.start) ? a : b,
    );
    const isFirst =
      caption.index != null && first.index != null
        ? caption.index === first.index
        : caption.start === first.start && caption.end === first.end;
    if (isFirst && Math.abs(caption.start - keep.start) < thresholdSec) {
      return keep.start;
    }
  } else {
    const last = inKeep.reduce((a, b) =>
      (a.index ?? a.end) >= (b.index ?? b.end) ? a : b,
    );
    const isLast =
      caption.index != null && last.index != null
        ? caption.index === last.index
        : caption.start === last.start && caption.end === last.end;
    if (isLast && Math.abs(keep.end - caption.end) < thresholdSec) {
      return keep.end;
    }
  }

  return wordSec;
}

/**
 * Snap a word-action range to keep edges when the boundary word is the
 * first/last in its keep (same rules as transcript range-resize drag).
 */
export function snapWordActionRangeToKeeps(
  range: { start: number; end: number },
  words: readonly { globalIndex: number; start: number; end: number }[],
  keeps: readonly { start: number; end: number }[],
): { start: number; end: number } {
  if (keeps.length === 0 || words.length === 0) return range;

  const indexed = words.map((w) => ({
    start: w.start,
    end: w.end,
    index: w.globalIndex,
  }));
  const keepList = [...keeps];
  const startWord =
    words.find((w) => Math.abs(w.start - range.start) < 0.001) ?? null;
  const endWord =
    words.find((w) => Math.abs(w.end - range.end) < 0.001) ?? null;

  const start = startWord
    ? snapTranscriptCaptionEdge(
        {
          start: startWord.start,
          end: startWord.end,
          index: startWord.globalIndex,
        },
        "start",
        indexed,
        keepList,
      )
    : range.start;
  const end = endWord
    ? snapTranscriptCaptionEdge(
        {
          start: endWord.start,
          end: endWord.end,
          index: endWord.globalIndex,
        },
        "end",
        indexed,
        keepList,
      )
    : range.end;

  return { start, end: Math.max(end, start) };
}

/**
 * Copy of words with first/last-in-keep edges snapped to keep bounds.
 * Use for edit timing so callers can read `.start`/`.end` without threading keeps.
 */
export function snapWordBoundsToKeepEdges<
  T extends { globalIndex: number; start: number; end: number },
>(words: readonly T[], keeps: readonly { start: number; end: number }[]): T[] {
  if (keeps.length === 0 || words.length === 0) return [...words];

  const indexed = words.map((w) => ({
    start: w.start,
    end: w.end,
    index: w.globalIndex,
  }));
  const keepList = [...keeps];

  return words.map((word) => {
    const start = snapTranscriptCaptionEdge(
      { start: word.start, end: word.end, index: word.globalIndex },
      "start",
      indexed,
      keepList,
    );
    const end = snapTranscriptCaptionEdge(
      { start: word.start, end: word.end, index: word.globalIndex },
      "end",
      indexed,
      keepList,
    );
    if (start === word.start && end === word.end) return word;
    return { ...word, start, end: Math.max(end, start) };
  });
}
