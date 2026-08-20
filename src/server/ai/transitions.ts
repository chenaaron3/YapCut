import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import type { Edit } from "~/domain/project/project-config";
import type { GlobalTranscriptWord } from "~/domain/transcript/transcript";
import {
  interiorStitchesWithoutTransition,
  placeTransitionAtStitch,
  seedListicleTransitions,
  seedOpeningClosingPair,
  stitchKey,
  type TransitionStitch,
} from "~/domain/edit/transition";
import { getOpenAIClient, OPENAI_MODEL } from "~/server/ai/openai";

import type { ArollLayoutCell } from "~/domain/aroll/arolls";

export const TransitionReconcileSchema = z.object({
  decisions: z
    .array(
      z.object({
        junctionIndex: z
          .number()
          .int()
          .nonnegative()
          .describe("Index from the candidate junction list"),
        applyTransition: z
          .boolean()
          .describe("true = place a flash transition on this keep-edge stitch"),
      }),
    )
    .describe("Yes/no for each remaining interior junction"),
});

export type TransitionReconcileDetection = z.infer<
  typeof TransitionReconcileSchema
>;

function formatJunctionsForPrompt(
  candidates: readonly TransitionStitch[],
): string {
  return candidates
    .map((j, i) => {
      if (j.kind !== "interior") return `${i}: ${stitchKey(j)}`;
      return `${i}: keep ${j.outKeepId} → keep ${j.inKeepId} (${stitchKey(j)})`;
    })
    .join("\n");
}

export function detectionToTransitionEdits(
  detection: TransitionReconcileDetection,
  candidates: readonly TransitionStitch[],
  existingEdits: readonly Edit[],
  layout: readonly ArollLayoutCell[],
): Edit[] {
  const used = new Set<number>();
  let edits = [...existingEdits];
  for (const row of detection.decisions) {
    if (!row.applyTransition) continue;
    if (used.has(row.junctionIndex)) continue;
    const stitch = candidates[row.junctionIndex];
    if (!stitch) continue;
    used.add(row.junctionIndex);
    edits = placeTransitionAtStitch(edits, stitch, "flash", layout);
  }
  return edits;
}

async function callOpenAI(
  candidates: readonly TransitionStitch[],
): Promise<TransitionReconcileDetection> {
  const client = getOpenAIClient();

  const completion = await client.chat.completions.parse({
    model: OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content: [
          "You decide which remaining A-roll keep-edge stitches get a short flash transition.",
          "Each candidate is already a valid punctuated sentence start at a keep edge.",
          "Opening and closing are already seeded. Do not invent cuts.",
          "Prefer yes on a clear new thought or list item; no on weak connective tissue.",
          "Return a decision for every candidate index listed.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          "Candidate junctions (index: keep → keep):",
          formatJunctionsForPrompt(candidates),
        ].join("\n"),
      },
    ],
    response_format: zodResponseFormat(
      TransitionReconcileSchema,
      "transition_reconcile",
    ),
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    const refusal = completion.choices[0]?.message.refusal;
    throw new Error(
      `OpenAI transition reconcile failed${refusal ? `: ${refusal}` : ""}`,
    );
  }

  return parsed;
}

/** LLM yes/no flash on remaining interior valid junctions. */
async function generateInteriorTransitions(
  words: readonly GlobalTranscriptWord[],
  edits: readonly Edit[],
  layout: readonly ArollLayoutCell[],
): Promise<Edit[]> {
  const candidates = interiorStitchesWithoutTransition(edits, words, layout);
  if (candidates.length === 0) return [...edits];

  const detection = await callOpenAI(candidates);
  return detectionToTransitionEdits(detection, candidates, edits, layout);
}

/**
 * Opening/closing pair, programmed listicle interiors, then LLM on leftover
 * interior stitches.
 */
export async function generateTransitionEdits(
  words: readonly GlobalTranscriptWord[],
  edits: readonly Edit[],
  layout: readonly ArollLayoutCell[],
): Promise<Edit[]> {
  let next = seedOpeningClosingPair(edits, layout, "flash");
  next = seedListicleTransitions(next, words, layout);
  return generateInteriorTransitions(words, next, layout);
}
