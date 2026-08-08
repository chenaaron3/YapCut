import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import { buildNumberedTranscript } from "~/domain/projection";
import type { GlobalTranscriptWord, TranscriptWord } from "~/domain/transcript";
import { getOpenAIClient, OPENAI_MODEL } from "~/server/ai/openai";

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
    .describe("Most significant word about every 10–15 words"),
});

export type EmphasisDetection = z.infer<typeof EmphasisDetectionSchema>;

async function callOpenAI(
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
          "Cadence: about one highlight every 10–15 words. In each window, pick only the single most significant content word.",
          "Never highlight function words (don't, your, the, a, to, of, and, but).",
          "Return indices into the numbered transcript.",
        ].join(" "),
      },
      {
        role: "user",
        content: `Numbered transcript words:\n\n${numbered}`,
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
): Promise<Map<string, TranscriptWord[]>> {
  if (globalWords.length === 0) return new Map();
  const detection = await callOpenAI(globalWords);
  return applyEmphasisToAssetWords(
    globalWords,
    detection,
    transcriptsByAssetId,
  );
}
