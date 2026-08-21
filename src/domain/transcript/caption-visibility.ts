import { editHidesCaptions } from "~/domain/project/project-config";
import { isVocalizedPause } from "~/domain/transcript/filler";
import { isQuoteEdit } from "~/domain/vfx/quote";

import type { Edit } from "~/domain/project/project-config";
import type { GlobalTranscriptWord } from "~/domain/transcript/transcript";

const EPS = 0.001;

function rangesOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number },
): boolean {
  return a.start < b.end - EPS && b.start < a.end - EPS;
}

/** True when spoken (non-quote) captions would paint for this word. */
export function wordShowsSpokenCaptions(
  word: GlobalTranscriptWord,
  edits: readonly Edit[],
): boolean {
  if (word.inGap) return false;
  if (isVocalizedPause(word.text) || !word.text.trim()) return false;
  for (const edit of edits) {
    if (!rangesOverlap(word, edit)) continue;
    if (isQuoteEdit(edit) || editHidesCaptions(edit)) return false;
  }
  return true;
}

/** Earliest timeline word where project captions (not quote) are visible. */
export function firstVisibleSpokenCaptionWord(
  words: readonly GlobalTranscriptWord[],
  edits: readonly Edit[],
): GlobalTranscriptWord | null {
  for (const word of words) {
    if (wordShowsSpokenCaptions(word, edits)) return word;
  }
  return null;
}
