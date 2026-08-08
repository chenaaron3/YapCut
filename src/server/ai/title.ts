import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import { getOpenAIClient, OPENAI_MODEL } from "~/server/ai/openai";

const MAX_TITLE_WORDS = 5;

export const TitleDetectionSchema = z.object({
  title: z
    .string()
    .describe(
      `Punchy on-screen / post title, Title Case, max ${MAX_TITLE_WORDS} words`,
    )
    .refine(
      (value) => {
        const words = value.trim().split(/\s+/).filter(Boolean);
        return words.length >= 1 && words.length <= MAX_TITLE_WORDS;
      },
      { message: `Title must be 1–${MAX_TITLE_WORDS} words` },
    ),
});

export type TitleDetection = z.infer<typeof TitleDetectionSchema>;

function transcriptText(words: readonly { text: string }[]): string {
  return words
    .map((w) => w.text.trim())
    .filter(Boolean)
    .join(" ");
}

/** Generate a ≤5-word title from global/local transcript words. */
export async function generateTitle(
  words: readonly { text: string }[],
): Promise<string> {
  const client = getOpenAIClient();
  const text = transcriptText(words);
  if (!text.trim()) {
    throw new Error("Cannot generate title from empty transcript");
  }

  const completion = await client.chat.completions.parse({
    model: OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content: [
          "You write short titles for talking-head social videos.",
          `Max ${MAX_TITLE_WORDS} words. Title Case. Punchy and concrete.`,
          "No hashtags, emoji, quotes, or trailing punctuation.",
          "Capture the main topic; do not invent a series name unless the speaker says one.",
        ].join(" "),
      },
      {
        role: "user",
        content: `Transcript:\n\n${text}`,
      },
    ],
    response_format: zodResponseFormat(TitleDetectionSchema, "title_detection"),
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    const refusal = completion.choices[0]?.message.refusal;
    throw new Error(
      `OpenAI title generation failed${refusal ? `: ${refusal}` : ""}`,
    );
  }

  return parsed.title.trim();
}
