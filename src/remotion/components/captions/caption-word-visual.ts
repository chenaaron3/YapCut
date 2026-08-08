import type { CSSProperties } from "react";

import {
  WORD_STATE_BLEND_SEC,
  mergeWordStyle,
  type BackgroundStyle,
  type CaptionGroupStyle,
  type WordStyle,
} from "~/remotion/captions/style";
import type { CaptionWordProp } from "~/remotion/types";

import {
  wordBackgroundFadeT,
  wordStateBlendT,
  wordTypewriterCharStart,
} from "./caption-animation";
import { scrapRotationDeg, wordBackgroundChromeStyle } from "./CaptionBackground";
import {
  applyEmphasisFill,
  blendWordStyles,
  resolveWordStyleForState,
  wordStyleToCss,
} from "./caption-style-css";

export type CaptionWordVisual = {
  mount: boolean;
  opacity: number;
  transform?: string;
  wordCss: CSSProperties;
  backgroundCss: CSSProperties;
};

function resolvePaintStyle(
  groupStyle: CaptionGroupStyle,
  word: CaptionWordProp,
  frame: number,
  fps: number,
  cycleStates: boolean,
): WordStyle {
  if (!cycleStates) {
    return applyEmphasisFill(
      resolveWordStyleForState(groupStyle, "active"),
      word.emphasized,
    );
  }

  const blend = wordStateBlendT(frame, word, fps, WORD_STATE_BLEND_SEC);
  const from = resolveWordStyleForState(groupStyle, blend.from);
  const to = resolveWordStyleForState(groupStyle, blend.to);
  const mixed = blendWordStyles(from, to, blend.t);
  return applyEmphasisFill({ ...mixed, background: null }, word.emphasized);
}

function hasWordStateDeltas(style: CaptionGroupStyle): boolean {
  return Boolean(style.futureWordStyle || style.activeWordStyle);
}

function activeWordBackground(
  groupStyle: CaptionGroupStyle,
): BackgroundStyle | null | undefined {
  const active = mergeWordStyle(
    groupStyle.wordStyle,
    groupStyle.activeWordStyle,
  );
  const bg = active.background;
  if (!bg || bg.kind === "none") return null;
  return bg;
}

function resolveWordBackground(
  groupStyle: CaptionGroupStyle,
  word: CaptionWordProp,
  frame: number,
  fps: number,
  cycleStates: boolean,
): { background: BackgroundStyle | null | undefined; fade: number } {
  const activeBg = activeWordBackground(groupStyle);
  if (!cycleStates || !activeBg) {
    return {
      background: groupStyle.wordStyle.background,
      fade: 1,
    };
  }

  const fade = wordBackgroundFadeT(
    frame,
    word,
    fps,
    WORD_STATE_BLEND_SEC,
  );
  if (fade <= 0) {
    return { background: null, fade: 0 };
  }
  return { background: activeBg, fade };
}

/**
 * Paint words for caption/text views.
 * Captions keep every word mounted for the full group so layout never shifts;
 * future words are hidden via `futureWordStyle.opacity` when needed.
 * Typewriter letter reveal / cursor live in {@link CaptionWordSpan}.
 */
export function resolveCaptionWordVisual(input: {
  word: CaptionWordProp;
  index: number;
  frame: number;
  fps: number;
  groupStartFrame: number;
  groupEndFrame: number;
  groupStyle: CaptionGroupStyle;
  /** When true, apply groupStyle.animation enter/exit on this word. */
  animateWord: boolean;
  /** When true, cycle past/active/future (if deltas exist). */
  cycleWordStates: boolean;
}): CaptionWordVisual {
  const {
    word,
    index,
    frame,
    fps,
    groupStartFrame,
    groupEndFrame,
    groupStyle,
    animateWord,
    cycleWordStates,
  } = input;

  const groupVisible = frame >= groupStartFrame && frame < groupEndFrame;
  const cycleStates = cycleWordStates && hasWordStateDeltas(groupStyle);
  const paint = resolvePaintStyle(
    groupStyle,
    word,
    frame,
    fps,
    cycleStates,
  );
  const bg = paint.background;
  const scrap = bg?.kind === "scrap";
  const typewriter = groupStyle.animation === "typewriter";
  const wordBackground = resolveWordBackground(
    groupStyle,
    word,
    frame,
    fps,
    cycleStates,
  );
  const backgroundCss = wordBackgroundChromeStyle(
    wordBackground.background,
    index,
    wordBackground.fade,
  );

  // Text VFX (StaticGroupView): parent owns group motion; typewriter may stagger letters.
  if (!animateWord) {
    if (typewriter && frame < word.startFrame) {
      return {
        mount: false,
        opacity: 0,
        wordCss: wordStyleToCss(paint),
        backgroundCss: {},
      };
    }
    return {
      mount: true,
      opacity: paint.opacity ?? 1,
      transform: scrap ? `rotate(${scrapRotationDeg(index)}deg)` : undefined,
      wordCss: wordStyleToCss({ ...paint, opacity: 1 }),
      backgroundCss,
    };
  }

  // Captions: all words stay mounted for the whole group; paint varies by word state.
  if (!groupVisible) {
    return {
      mount: false,
      opacity: 0,
      wordCss: wordStyleToCss(paint),
      backgroundCss: {},
    };
  }

  return {
    mount: true,
    opacity: paint.opacity ?? 1,
    transform: scrap ? `rotate(${scrapRotationDeg(index)}deg)` : undefined,
    wordCss: wordStyleToCss({ ...paint, opacity: 1 }),
    backgroundCss,
  };
}

/** Per-letter mount for caption typewriter (multi-char words). */
export function typewriterLetterVisible(
  word: CaptionWordProp,
  charIndex: number,
  charCount: number,
  frame: number,
): boolean {
  return frame >= wordTypewriterCharStart(word, charIndex, charCount);
}
