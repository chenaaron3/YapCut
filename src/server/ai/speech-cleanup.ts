import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import { buildArollLayout, keepCells } from "~/domain/arolls";
import {
  buildNumberedTranscript,
  keptTimelineWords,
  projectTimelineWords,
} from "~/domain/projection";
import {
  applyWordIndexCuts,
  vocalizedPauseCuts,
} from "~/domain/speech-cleanup";
import { getOpenAIClient, OPENAI_MODEL } from "~/server/ai/openai";

import type { ArollKeep } from "~/domain/project-config";
import type { WordIndexCut } from "~/domain/speech-cleanup";
import type { GlobalTranscriptWord, TranscriptWord } from "~/domain/transcript";

const MAX_CUTS = 80;

export const SpeechCleanupSchema = z.object({
  cuts: z
    .array(
      z.object({
        startWordIndex: z
          .number()
          .int()
          .nonnegative()
          .describe("First word to remove (inclusive)"),
        endWordIndex: z
          .number()
          .int()
          .nonnegative()
          .describe("Last word to remove (inclusive)"),
        kind: z
          .enum(["filler", "retake"])
          .describe("filler = vocalized pause; retake = discarded take"),
        reason: z
          .string()
          .describe("Why this span should be cut, one short sentence"),
      }),
    )
    .max(MAX_CUTS)
    .describe("Spans to cut from the talking-head take"),
});

export type SpeechCleanupDetection = z.infer<typeof SpeechCleanupSchema>;

export function detectionToWordIndexCuts(
  detection: SpeechCleanupDetection,
): WordIndexCut[] {
  return detection.cuts.map((cut) => ({
    startWordIndex: cut.startWordIndex,
    endWordIndex: cut.endWordIndex,
  }));
}

async function callOpenAI(
  words: readonly GlobalTranscriptWord[],
): Promise<SpeechCleanupDetection> {
  const client = getOpenAIClient();
  const numbered = buildNumberedTranscript(words);

  const completion = await client.chat.completions.parse({
    model: OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content: [
          "You clean a talking-head transcript by cutting redundant speech.",
          "Cut vocalized pauses: um, uh, uhm, uhh, er, ah, hmm, mm, mhm.",
          "Cut retakes: false starts, stutters, and restated takes. Remove the discarded take and keep the successful / final one.",
          "Do not cut discourse markers (like, you know, I mean, so, actually) unless they are clearly empty and carry no meaning.",
          "Do not cut content words, jokes, or the hook. Never cut the entire transcript.",
          "Return startWordIndex/endWordIndex into the numbered transcript.",
          `At most ${MAX_CUTS} cuts. Return an empty array if nothing should be removed.`,
        ].join(" "),
      },
      {
        role: "user",
        content: `Numbered transcript words:\n\n${numbered}`,
      },
    ],
    response_format: zodResponseFormat(SpeechCleanupSchema, "speech_cleanup"),
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    const refusal = completion.choices[0]?.message.refusal;
    throw new Error(
      `OpenAI speech cleanup failed${refusal ? `: ${refusal}` : ""}`,
    );
  }

  return parsed;
}

/** LLM retake/filler spans plus a deterministic vocalized-pause sweep. */
export async function generateSpeechCleanupCuts(
  words: readonly GlobalTranscriptWord[],
): Promise<WordIndexCut[]> {
  if (words.length === 0) return [];
  const detection = await callOpenAI(words);
  return [...detectionToWordIndexCuts(detection), ...vocalizedPauseCuts(words)];
}

export async function generateSpeechCleanupArolls(options: {
  arolls: readonly ArollKeep[];
  wordsByAssetId: ReadonlyMap<string, readonly TranscriptWord[]>;
  durationByAssetId: ReadonlyMap<string, number>;
}): Promise<ArollKeep[]> {
  const { arolls, wordsByAssetId, durationByAssetId } = options;
  const words = keptTimelineWords(
    projectTimelineWords(arolls, wordsByAssetId, durationByAssetId),
  );
  if (words.length === 0) return [...arolls];

  const cuts = await generateSpeechCleanupCuts(words);
  if (cuts.length === 0) return [...arolls];

  const layout = buildArollLayout(arolls, durationByAssetId);
  const keepRanges = keepCells(layout).map((cell) => cell.timeline);
  const next = applyWordIndexCuts(
    arolls,
    words,
    durationByAssetId,
    cuts,
    keepRanges,
  );
  console.log(
    `[ai-assist] speechCleanup cuts=${cuts.length} keeps=${arolls.length}→${next.length}`,
  );
  return next;
}
