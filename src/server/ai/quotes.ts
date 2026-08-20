import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import {
  buildNumberedTranscript,
  wordIndexToTimelineSec,
} from "~/domain/aroll/projection";
import type { Edit, VfxQuoteEdit } from "~/domain/project/project-config";
import { nextEditId } from "~/domain/project/project-config";
import { quoteRangeConflicts, quoteSeed } from "~/domain/vfx/quote";
import type { GlobalTranscriptWord } from "~/domain/transcript/transcript";
import { getOpenAIClient, OPENAI_MODEL } from "~/server/ai/openai";

const MAX_QUOTES = 30;
const MIN_WORDS = 3;
const MAX_WORDS = 10;
/** Minimum words between the end of one quote and the start of the next. */
const MIN_GAP_WORDS = 5;

export const QuoteDetectionSchema = z.object({
  quotes: z
    .array(
      z.object({
        startWordIndex: z
          .number()
          .int()
          .nonnegative()
          .describe("First word of the key phrase"),
        endWordIndex: z
          .number()
          .int()
          .nonnegative()
          .describe("Last word of the key phrase (inclusive)"),
        reason: z
          .string()
          .describe("Why this key phrase deserves a quote card"),
      }),
    )
    .max(MAX_QUOTES)
    .describe(
      "Key-phrase quotes only — sparse, high-impact fragments; first must start at word 0",
    ),
});

export type QuoteDetection = z.infer<typeof QuoteDetectionSchema>;

function spanWords(start: number, end: number): number {
  return end - start + 1;
}

/** Ensure opening quote starts at word 0; drop empty / invalid spans. */
export function normalizeQuoteDetection(
  detection: QuoteDetection,
  wordCount: number,
): QuoteDetection {
  if (wordCount < MIN_WORDS) return { quotes: [] };

  const quotes = detection.quotes
    .map((q) => ({
      ...q,
      startWordIndex: Math.max(0, Math.min(q.startWordIndex, wordCount - 1)),
      endWordIndex: Math.max(0, Math.min(q.endWordIndex, wordCount - 1)),
    }))
    .filter((q) => {
      if (q.endWordIndex < q.startWordIndex) return false;
      const span = spanWords(q.startWordIndex, q.endWordIndex);
      return span >= MIN_WORDS && span <= MAX_WORDS;
    })
    .sort((a, b) => a.startWordIndex - b.startWordIndex);

  const maxHookEnd = Math.min(MAX_WORDS - 1, wordCount - 1);
  if (quotes.length === 0 || quotes[0]!.startWordIndex !== 0) {
    const candidateEnd =
      quotes[0] != null
        ? Math.min(quotes[0].endWordIndex, maxHookEnd)
        : maxHookEnd;
    const end = Math.max(MIN_WORDS - 1, candidateEnd);
    return {
      quotes: [
        {
          startWordIndex: 0,
          endWordIndex: end,
          reason: quotes[0]?.reason ?? "Opening hook key phrase",
        },
        ...quotes.filter((q) => q.startWordIndex > end),
      ].slice(0, MAX_QUOTES),
    };
  }

  return { quotes: quotes.slice(0, MAX_QUOTES) };
}

export function detectionToQuoteEdits(
  detection: QuoteDetection,
  words: readonly GlobalTranscriptWord[],
  existingEdits: readonly Edit[],
): VfxQuoteEdit[] {
  let nextId = nextEditId(existingEdits);
  const placed: VfxQuoteEdit[] = [];
  const seed = quoteSeed();
  const normalized = normalizeQuoteDetection(detection, words.length);

  let lastEndWord = -(MIN_GAP_WORDS + 1);

  for (const item of normalized.quotes.slice(0, MAX_QUOTES)) {
    if (item.endWordIndex < item.startWordIndex) continue;
    const span = spanWords(item.startWordIndex, item.endWordIndex);
    if (span < MIN_WORDS || span > MAX_WORDS) continue;

    // Leave at least MIN_GAP_WORDS between quote spans.
    if (item.startWordIndex <= lastEndWord + MIN_GAP_WORDS) continue;

    const start = wordIndexToTimelineSec(item.startWordIndex, words, "start");
    const end = wordIndexToTimelineSec(item.endWordIndex, words, "end");
    if (start == null || end == null || end <= start) continue;

    const range = { start, end };
    const allEdits = [...existingEdits, ...placed];
    if (quoteRangeConflicts(allEdits, range)) continue;

    placed.push({
      id: nextId,
      kind: "vfx",
      type: "quote",
      start,
      end,
      style: seed.style,
    });
    nextId += 1;
    lastEndWord = item.endWordIndex;
  }

  return placed;
}

async function callOpenAI(
  words: readonly GlobalTranscriptWord[],
): Promise<QuoteDetection> {
  const client = getOpenAIClient();
  const numbered = buildNumberedTranscript(words);

  const completion = await client.chat.completions.parse({
    model: OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content: [
          "You pick key-phrase quote cards for a talking-head short.",
          `Each quote is a high-impact fragment of ${MIN_WORDS}–${MAX_WORDS} words — not a full sentence or paragraph.`,
          "Only quote true key phrases (hooks, claims, contrasts, numbers, memorable lines). Skip filler and ordinary connective speech.",
          "The first quote MUST start at word index 0. Choose endWordIndex where that opening hook key phrase ends (still within the word limit).",
          `Leave at least ${MIN_GAP_WORDS} words between quotes. If two candidate ranges sit too close, pick a spaced subset inside each range (or drop one) — never merge past the word limit.`,
          "Overlap with zooms/text is fine; do not place on clear listicle indicator/value spans.",
          "Return startWordIndex/endWordIndex into the numbered transcript.",
          `At most ${MAX_QUOTES} quotes.`,
        ].join(" "),
      },
      {
        role: "user",
        content: `Numbered transcript words:\n\n${numbered}`,
      },
    ],
    response_format: zodResponseFormat(QuoteDetectionSchema, "quote_detection"),
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    const refusal = completion.choices[0]?.message.refusal;
    throw new Error(
      `OpenAI quote detection failed${refusal ? `: ${refusal}` : ""}`,
    );
  }

  return parsed;
}

/** Detect key-phrase quotes and return timeline VFX edits. */
export async function generateQuoteEdits(
  words: readonly GlobalTranscriptWord[],
  existingEdits: readonly Edit[],
): Promise<VfxQuoteEdit[]> {
  if (words.length === 0) return [];
  const detection = await callOpenAI(words);
  return detectionToQuoteEdits(detection, words, existingEdits);
}
