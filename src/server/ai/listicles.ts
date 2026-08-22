import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import {
  clampOverlayMiddle,
  nextEditId,
  type OverlayTemplateStyle,
  type VfxListicleEdit,
} from "~/domain/project/project-config";
import {
  buildNumberedTranscript,
  wordIndexToTimelineSec,
} from "~/domain/aroll/projection";
import { OVERLAY_TRANSFORM_DEFAULTS } from "~/domain/edit/transform";
import type { GlobalTranscriptWord } from "~/domain/transcript/transcript";
import { getOpenAIClient, OPENAI_MODEL } from "~/server/ai/openai";

const MAX_ITEMS = 5;
const MAX_HEADING_WORDS = 3;
const MAX_SUBHEADING_WORDS = 5;
/** When there is no spoken heading range, show heading briefly at subheading start. */
const FALLBACK_HEADING_SEC = 0.5;

export const ListicleDetectionSchema = z.object({
  items: z
    .array(
      z.object({
        heading: z
          .string()
          .describe(
            `Short on-screen heading with a noun + number, e.g. "Tip #1", "No. 1", "Hack #1", "First" (max ${MAX_HEADING_WORDS} words)`,
          ),
        headingStartWordIndex: z
          .number()
          .int()
          .nonnegative()
          .nullable()
          .describe(
            "First word of the spoken heading phrase, if a clear spoken heading exists; null when there is no good heading",
          ),
        subheading: z
          .string()
          .describe(
            `Short list item title in title case, e.g. "Mute Notifications", "Batch Your Emails", "Walk After Lunch" (max ${MAX_SUBHEADING_WORDS} words; keep a/of/the lowercase unless first/last)`,
          ),
        subheadingStartWordIndex: z
          .number()
          .int()
          .nonnegative()
          .describe("First spoken word of the list item subheading"),
        subheadingEndWordIndex: z
          .number()
          .int()
          .nonnegative()
          .describe("Last spoken word of the list item subheading (inclusive)"),
      }),
    )
    .max(MAX_ITEMS)
    .describe(
      "Ordered listicle items (1+); empty if no clear subheading items",
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
  listicleStyle: OverlayTemplateStyle,
): VfxListicleEdit[] {
  let nextId = nextEditId(existingEdits);
  const out: VfxListicleEdit[] = [];

  for (const item of detection.items.slice(0, MAX_ITEMS)) {
    const heading = clampWords(item.heading, MAX_HEADING_WORDS);
    const subheading = clampWords(item.subheading, MAX_SUBHEADING_WORDS);
    if (!heading || !subheading) continue;
    if (item.subheadingEndWordIndex < item.subheadingStartWordIndex) continue;

    const subStart = wordIndexToTimelineSec(
      item.subheadingStartWordIndex,
      words,
      "start",
    );
    const subEnd = wordIndexToTimelineSec(
      item.subheadingEndWordIndex,
      words,
      "end",
    );
    if (subStart == null || subEnd == null) continue;
    if (subEnd <= subStart) continue;

    const firstSubWord = words[item.subheadingStartWordIndex];
    const firstWordEnd = firstSubWord?.end ?? subStart + FALLBACK_HEADING_SEC;

    let start: number;
    let middleRaw: number;
    const end = subEnd;

    if (item.headingStartWordIndex != null) {
      const headingStart = wordIndexToTimelineSec(
        item.headingStartWordIndex,
        words,
        "start",
      );
      if (headingStart == null || subStart < headingStart) continue;
      start = headingStart;
      const lastHeadingWord = words[item.subheadingStartWordIndex - 1];
      middleRaw = lastHeadingWord?.end ?? subStart;
    } else {
      start = subStart;
      middleRaw = Math.min(subStart + FALLBACK_HEADING_SEC, firstWordEnd);
    }

    if (end <= start) continue;
    const middle = clampOverlayMiddle(start, middleRaw, end);
    out.push({
      id: nextId,
      kind: "vfx",
      type: "listicle",
      start,
      middle,
      end,
      heading,
      subheading,
      hideCaptions: true,
      style: listicleStyle,
      ...OVERLAY_TRANSFORM_DEFAULTS,
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
          "You extract listicle-style heading + subheading pairs from a talking-head transcript.",
          "Each item needs a short on-screen subheading; a spoken heading is preferred but optional.",
          "Headings denote a number + noun (or ordinal), e.g. tip one, number three, hack #2, first / second.",
          'Base sentence to riff on: speaker says "tip one is mute your notifications" → heading "Tip #1" (words covering "tip one"), subheading "Mute Your Notifications" (words covering "mute your notifications").',
          "Same pattern for tip two / hack three / number four, etc.",
          "For each item return:",
          `- heading: polished on-screen heading (Tip #1, No. 1, Hack #1, First) — max ${MAX_HEADING_WORDS} words; never trailing particles like is/the/are.`,
          "- headingStartWordIndex: first spoken heading word when a clear heading exists; null when there is no good spoken heading.",
          `- subheading: short value in title case (small words a/of/the lowercase unless first/last) — max ${MAX_SUBHEADING_WORDS} words.`,
          "- subheadingStartWordIndex / subheadingEndWordIndex: spoken subheading range; when a heading exists, prefer the subheading starting immediately after it (back-to-back).",
          "Return 1+ items when any clear subheadings exist; otherwise items: [].",
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
  listicleStyle: OverlayTemplateStyle,
): Promise<VfxListicleEdit[]> {
  if (words.length === 0) return [];
  const detection = await callOpenAI(words);
  return detectionToListicleEdits(
    detection,
    words,
    existingEdits,
    listicleStyle,
  );
}
