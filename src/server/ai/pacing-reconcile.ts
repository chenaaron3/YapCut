import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import {
  bareSentencesForPacing,
  type TranscriptSentence,
} from "~/domain/transcript/pacing";
import type { Edit, ZoomEdit } from "~/domain/project/project-config";
import { nextEditId } from "~/domain/project/project-config";
import type { GlobalTranscriptWord } from "~/domain/transcript/transcript";
import { TRANSFORM_DEFAULTS } from "~/domain/edit/transform";
import { ZOOM_STRENGTH } from "~/domain/edit/zoom";
import { getOpenAIClient, OPENAI_MODEL } from "~/server/ai/openai";

const SLOW_ZOOM_SCALE = ZOOM_STRENGTH.strong;

export const PacingReconcileSchema = z.object({
  decisions: z
    .array(
      z.object({
        sentenceIndex: z
          .number()
          .int()
          .nonnegative()
          .describe("Index from the candidate sentence list"),
        applySlowZoom: z
          .boolean()
          .describe("true = slow zoom over the entire sentence"),
      }),
    )
    .describe("Yes/no for each bare sentence candidate"),
});

export type PacingReconcileDetection = z.infer<typeof PacingReconcileSchema>;

function formatSentencesForPrompt(
  sentences: readonly TranscriptSentence[],
): string {
  return sentences
    .map(
      (s) =>
        `${s.index}: [${s.start.toFixed(2)}–${s.end.toFixed(2)}s] ${s.text}`,
    )
    .join("\n");
}

export function detectionToSlowZoomEdits(
  detection: PacingReconcileDetection,
  candidates: readonly TranscriptSentence[],
  existingEdits: readonly { id: number }[],
): ZoomEdit[] {
  const byIndex = new Map(candidates.map((s) => [s.index, s]));
  let nextId = nextEditId(existingEdits);
  const out: ZoomEdit[] = [];
  const used = new Set<number>();

  for (const row of detection.decisions) {
    if (!row.applySlowZoom) continue;
    if (used.has(row.sentenceIndex)) continue;
    const sentence = byIndex.get(row.sentenceIndex);
    if (!sentence) continue;
    if (sentence.end <= sentence.start) continue;

    out.push({
      id: nextId,
      kind: "zoom",
      start: sentence.start,
      end: sentence.end,
      scale: SLOW_ZOOM_SCALE,
      offsetX: TRANSFORM_DEFAULTS.offsetX,
      offsetY: TRANSFORM_DEFAULTS.offsetY,
      rotation: TRANSFORM_DEFAULTS.rotation,
      ease: true,
    });
    nextId += 1;
    used.add(row.sentenceIndex);
  }

  return out;
}

async function callOpenAI(
  candidates: readonly TranscriptSentence[],
): Promise<PacingReconcileDetection> {
  const client = getOpenAIClient();

  const completion = await client.chat.completions.parse({
    model: OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content: [
          "You decide which bare spoken sentences get a slow camera push-in.",
          "Each candidate sentence has no other edits on it yet.",
          "For each sentence return applySlowZoom true or false.",
          "Prefer yes when the sentence carries a thought worth a gentle push; no on filler, throat-clearing, or weak connective tissue.",
          "A slow zoom always covers the entire sentence — you only choose yes or no.",
          "Return a decision for every candidate index listed.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          "Candidate sentences (index: [time] text):",
          formatSentencesForPrompt(candidates),
        ].join("\n"),
      },
    ],
    response_format: zodResponseFormat(
      PacingReconcileSchema,
      "pacing_reconcile",
    ),
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    const refusal = completion.choices[0]?.message.refusal;
    throw new Error(
      `OpenAI pacing reconcile failed${refusal ? `: ${refusal}` : ""}`,
    );
  }

  return parsed;
}

/** Yes/no slow zooms on bare sentences (≥5 words, no overlapping edits). */
export async function generatePacingReconcileZooms(
  words: readonly GlobalTranscriptWord[],
  edits: readonly Edit[],
): Promise<ZoomEdit[]> {
  if (words.length === 0) return [];

  const candidates = bareSentencesForPacing(words, edits);
  if (candidates.length === 0) return [];

  const detection = await callOpenAI(candidates);
  return detectionToSlowZoomEdits(detection, candidates, edits);
}
