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
    .describe("Highlighted content words"),
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
        `${i}: words ${r.startWordIndex}–${r.endWordIndex}`,
    )
    .join("\n");
}

function mergeDetections(
  ...detections: readonly EmphasisDetection[]
): EmphasisDetection {
  const seen = new Set<number>();
  const words: EmphasisDetection["words"] = [];
  for (const detection of detections) {
    for (const entry of detection.words) {
      if (seen.has(entry.wordIndex)) continue;
      seen.add(entry.wordIndex);
      words.push(entry);
    }
  }
  return { words };
}

async function callSparseEmphasis(
  words: readonly GlobalTranscriptWord[],
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
          "Cover the entire script sparsely: about one highlight every 10–15 words — only the single most significant content word per window.",
          "Ignore any quote cards or punch phrases; this pass is global only.",
          "Never highlight function words (don't, your, the, a, to, of, and, but).",
          "Return indices into the numbered transcript.",
        ].join(" "),
      },
      {
        role: "user",
        content: ["Numbered transcript words:", numbered].join("\n"),
      },
    ],
    response_format: zodResponseFormat(
      EmphasisDetectionSchema,
      "emphasis_sparse",
    ),
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    const refusal = completion.choices[0]?.message.refusal;
    throw new Error(
      `OpenAI sparse emphasis detection failed${refusal ? `: ${refusal}` : ""}`,
    );
  }

  return parsed;
}

async function callDenseQuoteEmphasis(
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
          "You pick denser on-screen caption highlights inside quote punch phrases.",
          "Only return word indices that fall inside the given quote ranges.",
          "Inside each quote range: emphasize most content words (skip function words).",
          "Never highlight function words (don't, your, the, a, to, of, and, but).",
          "Do not pick words outside the quote ranges.",
          "Return indices into the numbered transcript.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          "Quote ranges (dense emphasis only inside these):",
          formatQuoteRanges(quoteRanges),
          "",
          "Numbered transcript words:",
          numbered,
        ].join("\n"),
      },
    ],
    response_format: zodResponseFormat(
      EmphasisDetectionSchema,
      "emphasis_quote_dense",
    ),
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    const refusal = completion.choices[0]?.message.refusal;
    throw new Error(
      `OpenAI quote emphasis detection failed${refusal ? `: ${refusal}` : ""}`,
    );
  }

  // Keep only indices that actually fall in a quote range.
  const inQuote = (index: number) =>
    quoteRanges.some(
      (r) => index >= r.startWordIndex && index <= r.endWordIndex,
    );

  return {
    words: parsed.words.filter((w) => inQuote(w.wordIndex)),
  };
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

/**
 * Two-pass emphasis: sparse across the whole script, then denser inside
 * quote ranges. Results are unioned (same `emphasized` flag).
 */
export async function generateEmphasisUpdates(
  globalWords: readonly GlobalTranscriptWord[],
  transcriptsByAssetId: Map<string, TranscriptWord[]>,
  edits: readonly Edit[] = [],
): Promise<Map<string, TranscriptWord[]>> {
  if (globalWords.length === 0) return new Map();

  const ranges = quoteWordRanges(edits, globalWords);
  const [sparse, dense] = await Promise.all([
    callSparseEmphasis(globalWords),
    ranges.length > 0
      ? callDenseQuoteEmphasis(globalWords, ranges)
      : Promise.resolve<EmphasisDetection>({ words: [] }),
  ]);

  return applyEmphasisToAssetWords(
    globalWords,
    mergeDetections(sparse, dense),
    transcriptsByAssetId,
  );
}
