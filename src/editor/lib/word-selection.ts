import { expandWordDeleteRange } from "~/domain/keeps";
import { isSelected } from "~/editor/lib/selection";

import type { TimelineTime } from "~/domain/time";
import type { GlobalTranscriptWord } from "~/domain/transcript";
import type { Selection } from "~/editor/lib/selection";

/** Range for word actions: expand to selection when the word is selected. */
export function wordActionRange(
  selection: Selection | null,
  word: GlobalTranscriptWord,
  words: readonly GlobalTranscriptWord[],
): { start: number; end: number } {
  if (
    selection?.kind === "word" &&
    isSelected(selection, "word", word.globalIndex)
  ) {
    const selected = selection.ids
      .filter((i): i is number => typeof i === "number")
      .map((i) => words[i])
      .filter((w): w is GlobalTranscriptWord => w != null);
    if (selected.length > 0) {
      return {
        start: Math.min(...selected.map((w) => w.start)),
        end: Math.max(...selected.map((w) => w.end)),
      };
    }
  }
  return { start: word.start, end: word.end };
}

/** Word-delete range: selection span, then auto-trim margin to neighboring kept words. */
export function wordDeleteRange(
  selection: Selection | null,
  word: GlobalTranscriptWord,
  words: readonly GlobalTranscriptWord[],
  keepRanges: readonly TimelineTime[],
): TimelineTime {
  return expandWordDeleteRange(
    wordActionRange(selection, word, words),
    words,
    keepRanges,
  );
}
