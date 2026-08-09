import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import { buildNumberedTranscript } from "~/domain/projection";
import type { Edit } from "~/domain/project-config";
import { isQuoteEdit } from "~/domain/quote";
import type { GlobalTranscriptWord, TranscriptWord } from "~/domain/transcript";
import { getOpenAIClient, OPENAI_MODEL } from "~/server/ai/openai";

export type QuoteWordRange = {
  startWordIndex: number;
  endWordIndex: number;
};

export const EmphasisDetectionSchema = z.object({
  words: z
    .array(
      z.object({
        wordIndex: z
          .number()
          .int()
          .nonnegative()
          .describe("Index of the word in the numbered transcript"),
        reason: z
          .string()
          .describe("Why this word is the highlight, one short sentence"),
      }),
    )
    .describe(
      "Sparse outside quotes (~every 10–15 words); most content words inside each quote range",
    ),
});

export type EmphasisDetection = z.infer<typeof EmphasisDetectionSchema>;

/** Map quote edits → covering global word index ranges. */
export function quoteWordRanges(
  edits: readonly Edit[],
  words: readonly GlobalTranscriptWord[],
): QuoteWordRange[] {
  const ranges: QuoteWordRange[] = [];
  for (const edit of edits) {
    if (!isQuoteEdit(edit)) continue;
    const covered = words.filter(
      (w) =>
        !w.inGap &&
        w.start < edit.end - 0.001 &&
        w.end > edit.start + 0.001,
    );
    if (covered.length === 0) continue;
    ranges.push({
      startWordIndex: covered[0]!.globalIndex,
      endWordIndex: covered[covered.length - 1]!.globalIndex,
    });
  }
  return ranges;
}

function formatQuoteRanges(ranges: readonly QuoteWordRange[]): string {
  if (ranges.length === 0) return "None.";
  return ranges
    .map(
      (r, i) =>
        `${i}: words ${r.startWordIndex}–${r.endWordIndex} (emphasize most content words here)`,
    )
    .join("\n");
}

async function callOpenAI(
  words: readonly GlobalTranscriptWord[],
  quoteRanges: readonly QuoteWordRange[],
): Promise<EmphasisDetection> {
  const client = getOpenAIClient();
  const numbered = buildNumberedTranscript(words);

  const completion = await client.chat.completions.parse({
    model: OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content: [
          "You pick on-screen caption highlight words from a talking-head transcript.",
          "Outside quote ranges: about one highlight every 10–15 words — only the single most significant content word per window.",
          "Inside quote ranges: denser — emphasize most content words in the punch phrase (skip function words).",
          "Never highlight function words (don't, your, the, a, to, of, and, but).",
          "Return indices into the numbered transcript.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          "Quote ranges (dense emphasis):",
          formatQuoteRanges(quoteRanges),
          "",
          "Numbered transcript words:",
          numbered,
        ].join("\n"),
      },
    ],
    response_format: zodResponseFormat(
      EmphasisDetectionSchema,
      "emphasis_detection",
    ),
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    const refusal = completion.choices[0]?.message.refusal;
    throw new Error(
      `OpenAI emphasis detection failed${refusal ? `: ${refusal}` : ""}`,
    );
  }

  return parsed;
}

/**
 * Apply emphasis onto per-asset word arrays using global projected indices.
 * Returns a map of assetId → updated words (only assets that changed).
 */
export function applyEmphasisToAssetWords(
  globalWords: readonly GlobalTranscriptWord[],
  detection: EmphasisDetection,
  transcriptsByAssetId: Map<string, TranscriptWord[]>,
): Map<string, TranscriptWord[]> {
  const emphasizedGlobal = new Set<number>();
  for (const entry of detection.words) {
    if (entry.wordIndex < 0 || entry.wordIndex >= globalWords.length) continue;
    emphasizedGlobal.add(entry.wordIndex);
  }

  const updated = new Map<string, TranscriptWord[]>();

  for (const gWord of globalWords) {
    if (!emphasizedGlobal.has(gWord.globalIndex)) continue;
    const existing = updated.get(gWord.assetId) ?? [
      ...(transcriptsByAssetId.get(gWord.assetId) ?? []),
    ];
    const local = existing[gWord.localIndex];
    if (!local) continue;
    existing[gWord.localIndex] = { ...local, emphasized: true };
    updated.set(gWord.assetId, existing);
  }

  return updated;
}

export async function generateEmphasisUpdates(
  globalWords: readonly GlobalTranscriptWord[],
  transcriptsByAssetId: Map<string, TranscriptWord[]>,
  edits: readonly Edit[] = [],
): Promise<Map<string, TranscriptWord[]>> {
  if (globalWords.length === 0) return new Map();
  const ranges = quoteWordRanges(edits, globalWords);
  const detection = await callOpenAI(globalWords, ranges);
  return applyEmphasisToAssetWords(
    globalWords,
    detection,
    transcriptsByAssetId,
  );
}
