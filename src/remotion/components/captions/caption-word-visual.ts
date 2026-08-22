import type { CSSProperties } from "react";

import type { ResolvedEmphasisStyle } from "~/domain/transcript/emphasis-style";
import {
  WORD_STATE_BLEND_SEC,
  mergeWordStyle,
  type BackgroundStyle,
  type CaptionGroupStyle,
  type WordStyle,
} from "~/remotion/captions/style";
import type { CaptionWordProp } from "~/remotion/helpers/types";

import {
  wordBackgroundFadeT,
  wordStateBlendT,
  wordTypewriterCharStart,
} from "./caption-animation";
import { scrapRotationDeg, wordBackgroundChromeStyle } from "./CaptionBackground";
import {
  applyEmphasisStyle,
  blendWordStyles,
  captionFontCss,
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
  emphasis: ResolvedEmphasisStyle | null | undefined,
): WordStyle {
  if (!cycleStates) {
    return applyEmphasisStyle(
      resolveWordStyleForState(groupStyle, "active"),
      word.emphasized,
      emphasis,
    );
  }

  const blend = wordStateBlendT(frame, word, fps, WORD_STATE_BLEND_SEC);
  const from = resolveWordStyleForState(groupStyle, blend.from);
  const to = resolveWordStyleForState(groupStyle, blend.to);
  const mixed = blendWordStyles(from, to, blend.t);
  return applyEmphasisStyle(
    { ...mixed, background: null },
    word.emphasized,
    emphasis,
  );
}

function emphasisTypographyCss(
  groupStyle: CaptionGroupStyle,
  word: CaptionWordProp,
  emphasis: ResolvedEmphasisStyle | null | undefined,
): CSSProperties {
  if (!word.emphasized || !emphasis) return {};
  const css: CSSProperties = {};
  if (emphasis.scale !== 1) {
    css.fontSize = groupStyle.fontSize * emphasis.scale;
  }
  const fontFamily = word.emphasisFontFamily ?? emphasis.fontFamily;
  if (fontFamily) {
    Object.assign(css, captionFontCss(fontFamily));
  }
  return css;
}

function hasWordStateDeltas(style: CaptionGroupStyle): boolean {
  return Boolean(style.futureWordStyle ?? style.activeWordStyle);
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
 * Fill/stroke/shadow CSS for a word. Typewriter letter reveal is `wordReveal`
 * in CaptionWordSpan.
 *
 * Overlay (`cycleWordStates` false): group owns enter; words stay mounted
 * so typewriter does not reflow. Captions: every word stays mounted for the
 * group; past/active/future paint comes from style deltas.
 */
export function resolveCaptionWordVisual(input: {
  word: CaptionWordProp;
  index: number;
  frame: number;
  fps: number;
  groupStartFrame: number;
  groupEndFrame: number;
  groupStyle: CaptionGroupStyle;
  emphasisStyle?: ResolvedEmphasisStyle | null;
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
    emphasisStyle,
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
    emphasisStyle,
  );
  const emphasisCss = emphasisTypographyCss(
    groupStyle,
    word,
    emphasisStyle,
  );
  const bg = paint.background;
  const scrap = bg?.kind === "scrap";
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

  // Overlay: group owns enter. Keep every word mounted so typewriter
  // letter slots (visibility) do not reflow the line as glyphs appear.
  if (!cycleWordStates) {
    return {
      mount: true,
      opacity: paint.opacity ?? 1,
      transform: scrap ? `rotate(${scrapRotationDeg(index)}deg)` : undefined,
      wordCss: {
        ...wordStyleToCss({ ...paint, opacity: 1 }),
        ...emphasisCss,
      },
      backgroundCss,
    };
  }

  // Captions: all words stay mounted for the whole group; paint varies by word state.
  if (!groupVisible) {
    return {
      mount: false,
      opacity: 0,
      wordCss: { ...wordStyleToCss(paint), ...emphasisCss },
      backgroundCss: {},
    };
  }

  return {
    mount: true,
    opacity: paint.opacity ?? 1,
    transform: scrap ? `rotate(${scrapRotationDeg(index)}deg)` : undefined,
    wordCss: {
      ...wordStyleToCss({ ...paint, opacity: 1 }),
      ...emphasisCss,
    },
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
