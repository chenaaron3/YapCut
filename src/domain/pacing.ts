import type { Edit } from "~/domain/project-config";
import type { GlobalTranscriptWord } from "~/domain/transcript";

/** Minimum spoken words for a bare sentence to be a slow-zoom candidate. */
export const BARE_SENTENCE_MIN_WORDS = 5;

export type TranscriptSentence = {
  /** Stable index in the full sentence list (before bare filtering). */
  index: number;
  startWordIndex: number;
  endWordIndex: number;
  /** Timeline start/end of the sentence span. */
  start: number;
  end: number;
  text: string;
};

const EPS = 0.001;

function endsWithSentencePunctuation(text: string): boolean {
  return /[.?!]+$/.test(text.trim());
}

function spokenWords(
  words: readonly GlobalTranscriptWord[],
): GlobalTranscriptWord[] {
  return words.filter((w) => !w.inGap);
}

/**
 * Split spoken transcript words into sentences.
 * Boundaries: word ending in `.?!`, or a pause ≥ 0.6s between words.
 */
export function splitTranscriptSentences(
  words: readonly GlobalTranscriptWord[],
): TranscriptSentence[] {
  const spoken = spokenWords(words);
  if (spoken.length === 0) return [];

  const sentences: TranscriptSentence[] = [];
  let batch: GlobalTranscriptWord[] = [];

  const flush = () => {
    if (batch.length === 0) return;
    const first = batch[0]!;
    const last = batch[batch.length - 1]!;
    sentences.push({
      index: sentences.length,
      startWordIndex: first.globalIndex,
      endWordIndex: last.globalIndex,
      start: first.start,
      end: last.end,
      text: batch.map((w) => w.text).join(" "),
    });
    batch = [];
  };

  for (let i = 0; i < spoken.length; i++) {
    const word = spoken[i]!;
    batch.push(word);

    const next = spoken[i + 1];
    const punctBreak = endsWithSentencePunctuation(word.text);
    const pauseBreak =
      next != null && next.start - word.end >= 0.6 && batch.length > 0;

    if (punctBreak || pauseBreak) flush();
  }
  flush();

  return sentences;
}

function rangesOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number },
): boolean {
  return a.start < b.end - EPS && b.start < a.end - EPS;
}

/** True if any edit range overlaps the sentence (emphasis is not an Edit). */
export function sentenceHasEdits(
  sentence: TranscriptSentence,
  edits: readonly Edit[],
): boolean {
  const range = { start: sentence.start, end: sentence.end };
  return edits.some((e) => rangesOverlap(e, range));
}

/**
 * Sentences with no overlapping edits and at least {@link BARE_SENTENCE_MIN_WORDS} words.
 * Candidates for pacing-reconcile slow zooms.
 */
export function bareSentencesForPacing(
  words: readonly GlobalTranscriptWord[],
  edits: readonly Edit[],
  minWords = BARE_SENTENCE_MIN_WORDS,
): TranscriptSentence[] {
  return splitTranscriptSentences(words).filter((s) => {
    const wordCount = s.endWordIndex - s.startWordIndex + 1;
    if (wordCount < minWords) return false;
    return !sentenceHasEdits(s, edits);
  });
}
