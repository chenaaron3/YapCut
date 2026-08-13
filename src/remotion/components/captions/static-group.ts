import type { CaptionGroupStyle } from "~/remotion/captions/style";
import type { CaptionGroupProp, CaptionWordProp } from "~/remotion/helpers/types";

import {
  LINE_BREAK_TOKEN,
  isLineBreakToken,
  typewriterWordTimings,
} from "./caption-animation";

export { LINE_BREAK_TOKEN, isLineBreakToken };

/**
 * Split overlay text into words, keeping `\n` as a line-break token.
 * Collapses horizontal whitespace; preserves explicit newlines.
 */
export function tokenizeStaticText(text: string): string[] {
  const trimmed = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!trimmed) return [];

  const tokens: string[] = [];
  const lines = trimmed.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) tokens.push(LINE_BREAK_TOKEN);
    const words = lines[i]!
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter((t) => t.length > 0);
    tokens.push(...words);
  }
  return tokens;
}

/**
 * Build a caption group for {@link StaticGroupView}.
 * - typewriter → word chunks with global char stagger (letters reveal in span)
 * - otherwise → spaced words, all visible from frame 0 (group enter animates wrapper)
 */
export function buildStaticGroup(
  text: string,
  style: CaptionGroupStyle,
  fps: number,
  durationFrames: number,
): CaptionGroupProp {
  const endFrame = Math.max(1, durationFrames);
  const tokens = tokenizeStaticText(text);
  const words: CaptionWordProp[] =
    style.animation === "typewriter"
      ? typewriterWordTimings(tokens, fps, endFrame)
      : tokens.map((word) => ({
          text: word,
          startFrame: 0,
          endFrame,
        }));

  return {
    words,
    startFrame: 0,
    endFrame,
    captionsAtATime: style.captionsAtATime,
    style,
  };
}
