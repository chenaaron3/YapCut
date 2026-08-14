import React, { useContext, type CSSProperties } from "react";

import type { ResolvedEmphasisStyle } from "~/domain/emphasis-style";
import type { CaptionGroupStyle } from "~/remotion/captions/style";
import type { CaptionWordProp } from "~/remotion/helpers/types";

import {
  ArcLayoutContext,
  arcGlyphBoxStyle,
  wordGlyphOffset,
  type ArcLayout,
} from "./arc-layout";
import { transformCaptionWord } from "./caption-style-css";
import {
  lastVisibleWordIndex,
  typewriterCursorBlink,
} from "./caption-animation";
import {
  resolveCaptionWordVisual,
  typewriterLetterVisible,
  type CaptionWordVisual,
} from "./caption-word-visual";

function isWhitespaceWord(text: string): boolean {
  return /^\s+$/.test(text);
}

function typewriterCursorAt(
  typewriter: boolean,
  silhouette: boolean,
  words: CaptionWordProp[],
  index: number,
  frame: number,
  groupEndFrame: number,
): boolean {
  return (
    !silhouette &&
    typewriter &&
    frame < groupEndFrame &&
    lastVisibleWordIndex(words, frame, false) === index &&
    typewriterCursorBlink(frame)
  );
}

function silhouettePaint(opacity: number): CSSProperties {
  return {
    opacity: opacity > 0 ? 1 : 0,
    color: "transparent",
    WebkitTextFillColor: "transparent",
  };
}

function ArcWordPaint({
  word,
  index,
  words,
  frame,
  groupEndFrame,
  groupStyle,
  visual,
  silhouette,
  typewriter,
  arc,
}: {
  word: CaptionWordProp;
  index: number;
  words: CaptionWordProp[];
  frame: number;
  groupEndFrame: number;
  groupStyle: CaptionGroupStyle;
  visual: CaptionWordVisual;
  silhouette: boolean;
  typewriter: boolean;
  arc: ArcLayout;
}) {
  const glyphs = Array.from(
    transformCaptionWord(word.text, groupStyle.textTransform),
  );
  const start = wordGlyphOffset(words, index, groupStyle);
  const lastVisible = glyphs.reduce((last, _ch, i) => {
    if (typewriter && !typewriterLetterVisible(word, i, glyphs.length, frame)) {
      return last;
    }
    return i;
  }, -1);
  const cursorPose =
    lastVisible >= 0
      ? (arc.glyphs[start + lastVisible + 1] ?? arc.glyphs[start + lastVisible])
      : null;
  const showCursor = typewriterCursorAt(
    typewriter,
    silhouette,
    words,
    index,
    frame,
    groupEndFrame,
  );

  return (
    <>
      {glyphs.map((ch, i) => {
        const pose = arc.glyphs[start + i];
        if (!pose) return null;
        const letterVisible =
          !typewriter ||
          typewriterLetterVisible(word, i, glyphs.length, frame);
        return (
          <span
            key={i}
            style={{
              ...arcGlyphBoxStyle(pose),
              visibility: letterVisible ? "visible" : "hidden",
              whiteSpace: "pre",
              ...(silhouette
                ? silhouettePaint(visual.opacity)
                : { opacity: visual.opacity, ...visual.wordCss }),
            }}
          >
            {ch}
          </span>
        );
      })}
      {showCursor && cursorPose ? (
        <span
          aria-hidden
          style={{
            ...arcGlyphBoxStyle(cursorPose),
            width: "0.08em",
            minWidth: 3,
            height: "0.85em",
            backgroundColor: groupStyle.wordStyle.fill,
          }}
        />
      ) : null}
    </>
  );
}

/**
 * Word paint. Flow = one inline-block span (CSS text-transform).
 * Arc = one absolute span per glyph (JS text-transform; poses from context).
 */
export const CaptionWordSpan: React.FC<{
  word: CaptionWordProp;
  index: number;
  words: CaptionWordProp[];
  frame: number;
  fps: number;
  groupStartFrame: number;
  groupEndFrame: number;
  groupStyle: CaptionGroupStyle;
  emphasisStyle?: ResolvedEmphasisStyle | null;
  cycleWordStates: boolean;
  /** ContourBoard fill layer: keep glyphs, skip fill/stroke/shadow/chrome. */
  silhouette?: boolean;
}> = ({
  word,
  index,
  words,
  frame,
  fps,
  groupStartFrame,
  groupEndFrame,
  groupStyle,
  emphasisStyle,
  cycleWordStates,
  silhouette = false,
}) => {
  const visual = resolveCaptionWordVisual({
    word,
    index,
    frame,
    fps,
    groupStartFrame,
    groupEndFrame,
    groupStyle,
    emphasisStyle,
    cycleWordStates,
  });

  const arc = useContext(ArcLayoutContext);
  const whitespace = isWhitespaceWord(word.text);

  if (!visual.mount) {
    return (
      <span
        style={{
          visibility: "hidden",
          display: "inline-block",
          whiteSpace: whitespace ? "pre" : undefined,
        }}
      >
        {word.text}
      </span>
    );
  }

  const typewriter = groupStyle.wordReveal === "typewriter";

  if (arc && !whitespace) {
    return (
      <ArcWordPaint
        word={word}
        index={index}
        words={words}
        frame={frame}
        groupEndFrame={groupEndFrame}
        groupStyle={groupStyle}
        visual={visual}
        silhouette={silhouette}
        typewriter={typewriter}
        arc={arc}
      />
    );
  }

  const letterReveal = typewriter && word.text.length > 1 && !whitespace;
  const content = letterReveal
    ? Array.from(word.text).map((ch, i) => (
        <span
          key={i}
          style={{
            visibility: typewriterLetterVisible(
              word,
              i,
              word.text.length,
              frame,
            )
              ? "visible"
              : "hidden",
          }}
        >
          {ch}
        </span>
      ))
    : word.text;

  const showCursor = typewriterCursorAt(
    typewriter,
    silhouette,
    words,
    index,
    frame,
    groupEndFrame,
  );

  if (silhouette) {
    return (
      <span
        style={{
          display: "inline-block",
          whiteSpace: whitespace ? "pre" : undefined,
          ...silhouettePaint(visual.opacity),
        }}
      >
        {content}
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-block",
        whiteSpace: whitespace ? "pre" : undefined,
        opacity: visual.opacity,
        transform: visual.transform,
        ...visual.backgroundCss,
        ...visual.wordCss,
      }}
    >
      {content}
      {showCursor ? (
        <span
          aria-hidden
          style={{
            display: "inline-block",
            marginLeft: "0.06em",
            width: "0.08em",
            minWidth: 3,
            height: "0.9em",
            backgroundColor: groupStyle.wordStyle.fill,
            verticalAlign: "text-bottom",
          }}
        />
      ) : null}
    </span>
  );
};
