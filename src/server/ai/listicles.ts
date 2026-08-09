import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import { clampListicleMiddle } from "~/domain/listicle";
import {
  buildNumberedTranscript,
  wordIndexToTimelineSec,
} from "~/domain/projection";
import {
  nextEditId,
  type VfxListicleEdit,
} from "~/domain/project-config";
import type { GlobalTranscriptWord } from "~/domain/transcript";
import { getOpenAIClient, OPENAI_MODEL } from "~/server/ai/openai";

const MAX_ITEMS = 5;
const MAX_INDICATOR_WORDS = 3;
const MAX_VALUE_WORDS = 5;
/** When there is no spoken indicator, show indicator text briefly at value start. */
const FALLBACK_INDICATOR_SEC = 0.5;

export const ListicleDetectionSchema = z.object({
  items: z
    .array(
      z.object({
        indicatorText: z
          .string()
          .describe(
            `Short on-screen indicator with a noun + number, e.g. "Tip #1", "No. 1", "Hack #1", "First" (max ${MAX_INDICATOR_WORDS} words)`,
          ),
        indicatorStartWordIndex: z
          .number()
          .int()
          .nonnegative()
          .nullable()
          .describe(
            "First word of the spoken indicator phrase, if a clear spoken indicator exists; null when there is no good indicator",
          ),
        valueText: z
          .string()
          .describe(
            `Short list item title in title case, e.g. "Mute Notifications", "Batch Your Emails", "Walk After Lunch" (max ${MAX_VALUE_WORDS} words; keep a/of/the lowercase unless first/last)`,
          ),
        valueStartWordIndex: z
          .number()
          .int()
          .nonnegative()
          .describe("First spoken word of the list item value"),
        valueEndWordIndex: z
          .number()
          .int()
          .nonnegative()
          .describe("Last spoken word of the list item value (inclusive)"),
      }),
    )
    .max(MAX_ITEMS)
    .describe(
      "Ordered listicle items (1+); empty if no clear value items",
    ),
});

export type ListicleDetection = z.infer<typeof ListicleDetectionSchema>;

function clampWords(text: string, maxWords: number): string {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
    .join(" ");
}

export function detectionToListicleEdits(
  detection: ListicleDetection,
  words: readonly GlobalTranscriptWord[],
  existingEdits: readonly { id: number }[],
): VfxListicleEdit[] {
  let nextId = nextEditId(existingEdits);
  const out: VfxListicleEdit[] = [];

  for (const item of detection.items.slice(0, MAX_ITEMS)) {
    const indicatorText = clampWords(
      item.indicatorText,
      MAX_INDICATOR_WORDS,
    );
    const valueText = clampWords(item.valueText, MAX_VALUE_WORDS);
    if (!indicatorText || !valueText) continue;
    if (item.valueEndWordIndex < item.valueStartWordIndex) continue;

    const valueStart = wordIndexToTimelineSec(
      item.valueStartWordIndex,
      words,
      "start",
    );
    const valueEnd = wordIndexToTimelineSec(
      item.valueEndWordIndex,
      words,
      "end",
    );
    if (valueStart == null || valueEnd == null) continue;
    if (valueEnd <= valueStart) continue;

    const firstValueWord = words[item.valueStartWordIndex];
    const firstWordEnd = firstValueWord?.end ?? valueStart + FALLBACK_INDICATOR_SEC;

    let start: number;
    let middleRaw: number;
    const end = valueEnd;

    if (item.indicatorStartWordIndex != null) {
      const indicatorStart = wordIndexToTimelineSec(
        item.indicatorStartWordIndex,
        words,
        "start",
      );
      if (indicatorStart == null || valueStart < indicatorStart) continue;
      start = indicatorStart;
      // Split at end of last indicator word (end-handle semantics).
      const lastIndicator = words[item.valueStartWordIndex - 1];
      middleRaw = lastIndicator?.end ?? valueStart;
    } else {
      start = valueStart;
      middleRaw = Math.min(valueStart + FALLBACK_INDICATOR_SEC, firstWordEnd);
    }

    if (end <= start) continue;
    const middle = clampListicleMiddle(start, middleRaw, end);
    out.push({
      id: nextId,
      kind: "vfx",
      type: "listicle",
      start,
      middle,
      end,
      indicatorText,
      valueText,
      hideCaptions: true,
    });
    nextId += 1;
  }

  return out;
}

async function callOpenAI(
  words: readonly GlobalTranscriptWord[],
): Promise<ListicleDetection> {
  const client = getOpenAIClient();
  const numbered = buildNumberedTranscript(words);

  const completion = await client.chat.completions.parse({
    model: OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content: [
          "You extract listicle-style indicator + value pairs from a talking-head transcript.",
          "Each item needs a short on-screen value; a spoken indicator is preferred but optional.",
          "Indicators denote a number + noun (or ordinal), e.g. tip one, number three, hack #2, first / second.",
          'Base sentence to riff on: speaker says "tip one is mute your notifications" → indicatorText "Tip #1" (words covering "tip one"), valueText "Mute Your Notifications" (words covering "mute your notifications").',
          "Same pattern for tip two / hack three / number four, etc.",
          "For each item return:",
          `- indicatorText: polished on-screen indicator (Tip #1, No. 1, Hack #1, First) — max ${MAX_INDICATOR_WORDS} words; never trailing particles like is/the/are.`,
          "- indicatorStartWordIndex: first spoken indicator word when a clear indicator exists; null when there is no good spoken indicator.",
          `- valueText: short value in title case (small words a/of/the lowercase unless first/last) — max ${MAX_VALUE_WORDS} words.`,
          "- valueStartWordIndex / valueEndWordIndex: spoken value range; when an indicator exists, prefer the value starting immediately after it (back-to-back).",
          "Return 1+ items when any clear values exist; otherwise items: [].",
          `At most ${MAX_ITEMS} items.`,
        ].join(" "),
      },
      {
        role: "user",
        content: `Numbered transcript words:\n\n${numbered}`,
      },
    ],
    response_format: zodResponseFormat(
      ListicleDetectionSchema,
      "listicle_detection",
    ),
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    const refusal = completion.choices[0]?.message.refusal;
    throw new Error(
      `OpenAI listicle detection failed${refusal ? `: ${refusal}` : ""}`,
    );
  }

  return parsed;
}

/** Detect listicle items and return timeline VFX edits. */
export async function generateListicleEdits(
  words: readonly GlobalTranscriptWord[],
  existingEdits: readonly { id: number }[],
): Promise<VfxListicleEdit[]> {
  if (words.length === 0) return [];
  const detection = await callOpenAI(words);
  return detectionToListicleEdits(detection, words, existingEdits);
}
