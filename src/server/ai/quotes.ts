import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import {
  buildNumberedTranscript,
  wordIndexToTimelineSec,
} from "~/domain/projection";
import type { Edit, VfxQuoteEdit } from "~/domain/project-config";
import { nextEditId } from "~/domain/project-config";
import { quoteRangeConflicts, quoteSeed } from "~/domain/quote";
import type { GlobalTranscriptWord } from "~/domain/transcript";
import { getOpenAIClient, OPENAI_MODEL } from "~/server/ai/openai";

const MAX_QUOTES = 30;
const MIN_WORDS = 3;
const MAX_WORDS = 8;

export const QuoteDetectionSchema = z.object({
  quotes: z
    .array(
      z.object({
        startWordIndex: z
          .number()
          .int()
          .nonnegative()
          .describe("First word of the punch phrase"),
        endWordIndex: z
          .number()
          .int()
          .nonnegative()
          .describe("Last word of the punch phrase (inclusive)"),
        reason: z
          .string()
          .describe("Why this punch phrase deserves a quote card"),
      }),
    )
    .max(MAX_QUOTES)
    .describe(
      "Pack the video with punch-phrase quotes — prefer many good ones over sparse restraint",
    ),
});

export type QuoteDetection = z.infer<typeof QuoteDetectionSchema>;

export function detectionToQuoteEdits(
  detection: QuoteDetection,
  words: readonly GlobalTranscriptWord[],
  existingEdits: readonly Edit[],
): VfxQuoteEdit[] {
  let nextId = nextEditId(existingEdits);
  const placed: VfxQuoteEdit[] = [];
  const seed = quoteSeed();

  for (const item of detection.quotes.slice(0, MAX_QUOTES)) {
    if (item.endWordIndex < item.startWordIndex) continue;
    const span = item.endWordIndex - item.startWordIndex + 1;
    if (span < MIN_WORDS || span > MAX_WORDS) continue;

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
          "You pick punch-phrase quote cards for a talking-head short.",
          `Each quote is a short high-impact fragment of ${MIN_WORDS}–${MAX_WORDS} words — not a full sentence.`,
          "Be greedy: quotes are cheap and effective. Aim for about one quote every ~4–5 seconds of speech whenever a punchy fragment exists.",
          "Cover hooks, claims, contrasts, numbers, and memorable lines. Overlap with zooms/text is fine; do not place on clear listicle indicator/value spans.",
          "Skip only true filler. Prefer more quotes over leaving long stretches without one.",
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

/** Detect punch-phrase quotes and return timeline VFX edits. */
export async function generateQuoteEdits(
  words: readonly GlobalTranscriptWord[],
  existingEdits: readonly Edit[],
): Promise<VfxQuoteEdit[]> {
  if (words.length === 0) return [];
  const detection = await callOpenAI(words);
  return detectionToQuoteEdits(detection, words, existingEdits);
}
