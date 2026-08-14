import { interpolate } from "remotion";

import {
  CAPTION_ENTER_SEC,
  TYPEWRITER_CHAR_DELAY_SEC,
} from "~/remotion/captions/style";

import type { CaptionGroupAnimation } from "~/remotion/captions/style";

import type { CaptionWordProp } from "~/remotion/helpers/types";

export const SLIDE_OFFSET_PX = 28;

/** Explicit line break in static overlay text (Shift+Enter). */
export const LINE_BREAK_TOKEN = "\n";

export function isLineBreakToken(text: string): boolean {
  return text === LINE_BREAK_TOKEN;
}

export type CaptionMotion = {
  opacity: number;
  scale: number;
  translateY: number;
  /** Degrees. Omit / 0 = none. */
  rotate: number;
  /** Typewriter: false until the glyph should exist in layout. */
  mount: boolean;
};

export function enterFramesFor(fps: number): number {
  return Math.max(2, Math.round(CAPTION_ENTER_SEC * fps));
}

export function shouldSkipMotion(
  durationFrames: number,
  enterFrames: number,
): boolean {
  return durationFrames < enterFrames;
}

/**
 * Enter/exit motion for a timed target (word or group).
 * Exit mirrors enter near the end of `endFrame`.
 */
export function resolveEnterExitMotion(input: {
  animation: CaptionGroupAnimation;
  frame: number;
  startFrame: number;
  endFrame: number;
  fps: number;
}): CaptionMotion {
  const { animation, frame, startFrame, endFrame, fps } = input;
  const enterFrames = enterFramesFor(fps);
  const duration = Math.max(1, endFrame - startFrame);
  const skip = shouldSkipMotion(duration, enterFrames);

  if (frame < startFrame) {
    return { opacity: 0, scale: 1, translateY: 0, rotate: 0, mount: false };
  }
  if (frame >= endFrame) {
    return { opacity: 0, scale: 1, translateY: 0, rotate: 0, mount: false };
  }

  if (animation === "none" || animation === "wipe" || skip) {
    return { opacity: 1, scale: 1, translateY: 0, rotate: 0, mount: true };
  }

  const local = frame - startFrame;
  const exitFrames = Math.min(
    enterFrames,
    Math.max(1, Math.floor(duration / 2)),
  );
  const exitStart = Math.max(enterFrames, duration - exitFrames);

  let enterT = 1;
  if (local < enterFrames) {
    enterT = interpolate(local, [0, enterFrames], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  let exitT = 0;
  if (local >= exitStart) {
    exitT = interpolate(local, [exitStart, duration], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  const t = enterT * (1 - exitT);

  switch (animation) {
    case "fade":
      return { opacity: t, scale: 1, translateY: 0, rotate: 0, mount: true };
    case "scale": {
      const enterScale =
        local < enterFrames
          ? interpolate(
              local,
              [0, enterFrames * 0.6, enterFrames],
              [0.4, 1.25, 1],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            )
          : 1;
      const exitScale =
        local >= exitStart
          ? interpolate(local, [exitStart, duration], [1, 0.85], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : 1;
      return {
        opacity: local >= exitStart ? 1 - exitT : 1,
        scale: enterScale * exitScale,
        translateY: 0,
        rotate: 0,
        mount: true,
      };
    }
    case "slide": {
      const enterY =
        local < enterFrames
          ? interpolate(local, [0, enterFrames], [-SLIDE_OFFSET_PX, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : 0;
      const exitY =
        local >= exitStart
          ? interpolate(local, [exitStart, duration], [0, SLIDE_OFFSET_PX], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : 0;
      return {
        opacity: t,
        scale: 1,
        translateY: enterY + exitY,
        rotate: 0,
        mount: true,
      };
    }
    case "bounce": {
      const enterScale =
        local < enterFrames
          ? interpolate(
              local,
              [0, enterFrames * 0.5, enterFrames],
              [0.45, 1.22, 1],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            )
          : 1;
      const enterY =
        local < enterFrames
          ? interpolate(
              local,
              [0, enterFrames * 0.45, enterFrames],
              [18, -7, 0],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            )
          : 0;
      const exitScale =
        local >= exitStart
          ? interpolate(local, [exitStart, duration], [1, 0.8], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : 1;
      const exitY =
        local >= exitStart
          ? interpolate(local, [exitStart, duration], [0, 10], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : 0;
      return {
        opacity: local >= exitStart ? 1 - exitT : 1,
        scale: enterScale * exitScale,
        translateY: enterY + exitY,
        rotate: 0,
        mount: true,
      };
    }
    case "spin": {
      const enterRot =
        local < enterFrames
          ? interpolate(local, [0, enterFrames], [-90, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : 0;
      const exitRot =
        local >= exitStart
          ? interpolate(local, [exitStart, duration], [0, 45], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : 0;
      return {
        opacity: t,
        scale: 1,
        translateY: 0,
        rotate: enterRot + exitRot,
        mount: true,
      };
    }
    default:
      return { opacity: 1, scale: 1, translateY: 0, rotate: 0, mount: true };
  }
}

export type WordState = "future" | "active" | "past";

export function wordStateAt(frame: number, word: CaptionWordProp): WordState {
  if (frame < word.startFrame) return "future";
  if (frame >= word.endFrame) return "past";
  return "active";
}

/** Fade 0–1 for word-level highlight backgrounds entering/leaving the active state. */
export function wordBackgroundFadeT(
  frame: number,
  word: CaptionWordProp,
  fps: number,
  blendSec: number,
): number {
  const blendFrames = Math.max(1, Math.round(blendSec * fps));
  const state = wordStateAt(frame, word);

  if (state === "active") {
    const since = frame - word.startFrame;
    if (since < blendFrames) {
      return interpolate(since, [0, blendFrames], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    }
    return 1;
  }

  if (state === "past") {
    const since = frame - word.endFrame;
    if (since < blendFrames) {
      return interpolate(since, [0, blendFrames], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    }
    return 0;
  }

  return 0;
}

/** Blend progress 0–1 while leaving `from` toward `to` around a boundary. */
export function wordStateBlendT(
  frame: number,
  word: CaptionWordProp,
  fps: number,
  blendSec: number,
): { from: WordState; to: WordState; t: number } {
  const blendFrames = Math.max(1, Math.round(blendSec * fps));
  const state = wordStateAt(frame, word);

  if (state === "active") {
    const since = frame - word.startFrame;
    if (since < blendFrames) {
      return {
        from: "future",
        to: "active",
        t: interpolate(since, [0, blendFrames], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      };
    }
    return { from: "active", to: "active", t: 1 };
  }

  if (state === "past") {
    const since = frame - word.endFrame;
    if (since < blendFrames) {
      return {
        from: "active",
        to: "past",
        t: interpolate(since, [0, blendFrames], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      };
    }
    return { from: "past", to: "past", t: 1 };
  }

  return { from: "future", to: "future", t: 1 };
}

/** Char count for typewriter stagger: words + implicit spaces; `\n` is one beat. */
function typewriterCharCount(tokens: string[]): number {
  let n = 0;
  for (let i = 0; i < tokens.length; i++) {
    n += tokens[i]!.length;
    const next = tokens[i + 1];
    if (next && !isLineBreakToken(tokens[i]!) && !isLineBreakToken(next)) n += 1;
  }
  return n;
}

/**
 * Static typewriter: word chunks with global char stagger.
 * Spaces between words on the same line are implicit (flex gap); timing
 * includes a beat per space. `\n` tokens are explicit line breaks (one beat).
 * Letter reveal inside each word uses {@link wordTypewriterCharStart}.
 * Uses {@link TYPEWRITER_CHAR_DELAY_SEC} when it fits; otherwise compresses to `endFrame`.
 */
export function typewriterWordTimings(
  tokens: string[],
  fps: number,
  endFrame: number,
): CaptionWordProp[] {
  if (tokens.length === 0) return [];

  const totalChars = typewriterCharCount(tokens);
  const groupEnd = Math.max(1, endFrame);

  const idealDelay = Math.max(1, Math.round(TYPEWRITER_CHAR_DELAY_SEC * fps));
  const idealTotal = Math.max(1, totalChars) * idealDelay;
  const fitsIdeal = idealTotal <= groupEnd;

  const frameAt = (charIndex: number): number => {
    if (fitsIdeal) return charIndex * idealDelay;
    if (totalChars <= 0) return 0;
    return Math.min(
      groupEnd - 1,
      Math.floor((charIndex / totalChars) * groupEnd),
    );
  };

  let charOffset = 0;

  return tokens.map((wordText, i) => {
    const startFrame = frameAt(charOffset);
    const wordEndFrame = frameAt(charOffset + wordText.length);
    charOffset += wordText.length;
    const next = tokens[i + 1];
    if (next && !isLineBreakToken(wordText) && !isLineBreakToken(next)) {
      charOffset += 1;
    }
    return {
      text: wordText,
      startFrame,
      endFrame: wordEndFrame,
    };
  });
}

/**
 * Word-scope typewriter: reveal letters across the word's own duration.
 * Returns start frames for each character relative to composition.
 */
export function wordTypewriterCharStart(
  word: CaptionWordProp,
  charIndex: number,
  charCount: number,
): number {
  if (charCount <= 1) return word.startFrame;
  const span = Math.max(1, word.endFrame - word.startFrame);
  const t = charIndex / charCount;
  return word.startFrame + Math.floor(t * span);
}
