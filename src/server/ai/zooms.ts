import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import {
  buildNumberedTranscript,
  wordIndexToTimelineSec,
} from "~/domain/projection";
import type { ZoomEdit } from "~/domain/project-config";
import { nextEditId } from "~/domain/project-config";
import type { GlobalTranscriptWord } from "~/domain/transcript";
import { getOpenAIClient, OPENAI_MODEL } from "~/server/ai/openai";

const MAX_ZOOMS = 10;
const MIN_DURATION_SEC = 0.8;
const MAX_DURATION_SEC = 3;
const MIN_GAP_SEC = 2;

export const PUNCH_IN_STRENGTH = {
  light: 1.05,
  medium: 1.1,
  strong: 1.15,
} as const;

export const ZoomDetectionSchema = z.object({
  punchIns: z
    .array(
      z.object({
        startWordIndex: z
          .number()
          .int()
          .nonnegative()
          .describe("First word of the emphasized phrase"),
        endWordIndex: z
          .number()
          .int()
          .nonnegative()
          .describe("Last word of the emphasized phrase"),
        strength: z
          .enum(["light", "medium", "strong"])
          .describe("light ≈ 1.05x, medium ≈ 1.10x, strong ≈ 1.15x"),
        reason: z
          .string()
          .describe("Why this moment deserves emphasis, one short sentence"),
      }),
    )
    .max(MAX_ZOOMS),
});

export type ZoomDetection = z.infer<typeof ZoomDetectionSchema>;

export function detectionToZoomEdits(
  detection: ZoomDetection,
  words: readonly GlobalTranscriptWord[],
  existingEdits: readonly { id: number }[],
): ZoomEdit[] {
  const mapped: Array<{ start: number; end: number; scale: number }> = [];

  for (const item of detection.punchIns.slice(0, MAX_ZOOMS)) {
    if (item.endWordIndex < item.startWordIndex) continue;

    const start = wordIndexToTimelineSec(item.startWordIndex, words, "start");
    const endRaw = wordIndexToTimelineSec(item.endWordIndex, words, "end");
    if (start == null || endRaw == null) continue;
    if (endRaw < start) continue;

    const duration = Math.min(
      MAX_DURATION_SEC,
      Math.max(MIN_DURATION_SEC, endRaw - start),
    );
    mapped.push({
      start,
      end: start + duration,
      scale: PUNCH_IN_STRENGTH[item.strength],
    });
  }

  mapped.sort((a, b) => a.start - b.start);

  const spaced: typeof mapped = [];
  for (const zoom of mapped) {
    const last = spaced[spaced.length - 1];
    if (last && zoom.start - last.end < MIN_GAP_SEC) continue;
    spaced.push(zoom);
  }

  let nextId = nextEditId(existingEdits);
  return spaced.map((zoom) => {
    const edit: ZoomEdit = {
      id: nextId,
      kind: "zoom",
      start: zoom.start,
      end: zoom.end,
      scale: zoom.scale,
    };
    nextId += 1;
    return edit;
  });
}

async function callOpenAI(
  words: readonly GlobalTranscriptWord[],
): Promise<ZoomDetection> {
  const client = getOpenAIClient();
  const numbered = buildNumberedTranscript(words);

  const completion = await client.chat.completions.parse({
    model: OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content: [
          "You pick moments in a talking-head transcript where a quick camera punch-in (zoom) would add impact.",
          "Look for hooks, payoffs, surprising statements, and key numbers.",
          "Return word indices into the numbered transcript: startWordIndex is the first word of the emphasized phrase, endWordIndex the last word.",
          "Prefer short phrases of a few words over whole sentences.",
          'Use strength "strong" only for the biggest moments; otherwise prefer "light" or "medium".',
          "Give a one-sentence reason for each pick.",
          `At most ${MAX_ZOOMS} punch-ins; fewer well-chosen moments beat forced ones. Return an empty array if nothing stands out.`,
        ].join(" "),
      },
      {
        role: "user",
        content: `Numbered transcript words:\n\n${numbered}`,
      },
    ],
    response_format: zodResponseFormat(ZoomDetectionSchema, "punch_in_detection"),
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    const refusal = completion.choices[0]?.message.refusal;
    throw new Error(
      `OpenAI zoom detection failed${refusal ? `: ${refusal}` : ""}`,
    );
  }

  return parsed;
}

/** Detect zoom moments and return global-time zoom edits. */
export async function generateZoomEdits(
  words: readonly GlobalTranscriptWord[],
  existingEdits: readonly { id: number }[],
): Promise<ZoomEdit[]> {
  if (words.length === 0) return [];
  const detection = await callOpenAI(words);
  return detectionToZoomEdits(detection, words, existingEdits);
}
