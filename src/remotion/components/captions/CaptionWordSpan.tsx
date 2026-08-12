import React, { useContext } from "react";

import type { ResolvedEmphasisStyle } from "~/domain/emphasis-style";
import type { CaptionGroupStyle } from "~/remotion/captions/style";
import type { CaptionWordProp } from "~/remotion/types";

import {
  lastVisibleWordIndex,
  typewriterCursorBlink,
} from "./caption-animation";
import {
  resolveCaptionWordVisual,
  typewriterLetterVisible,
} from "./caption-word-visual";
import {
  ArcLayoutContext,
  transformCaptionWord,
  wordGlyphOffset,
} from "./arc-layout";

export type { CaptionWordVisual } from "./caption-word-visual";
export { resolveCaptionWordVisual } from "./caption-word-visual";

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
  animateWord: boolean;
  cycleWordStates: boolean;
  /**
   * ContourBoard fill layer: keep layout glyphs, force transparent paint
   * (no fill/stroke/shadow/word background).
   */
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
  animateWord,
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
    animateWord,
    cycleWordStates,
  });

  const arcLayout = useContext(ArcLayoutContext);

  if (!visual.mount) return null;

  const whitespace = /^\s+$/.test(word.text);
  const typewriter = groupStyle.animation === "typewriter";
  const glyphs = Array.from(
    transformCaptionWord(word.text, groupStyle.textTransform),
  );
  const letterReveal = typewriter && glyphs.length > 1 && !whitespace;

  if (arcLayout && !whitespace) {
    const start = wordGlyphOffset(words, index, groupStyle);
    const lastVisible = glyphs.reduce((last, _ch, i) => {
      if (typewriter && !typewriterLetterVisible(word, i, glyphs.length, frame)) {
        return last;
      }
      return i;
    }, -1);
    const showCursor =
      !silhouette &&
      typewriter &&
      frame < groupEndFrame &&
      lastVisibleWordIndex(words, frame, false) === index &&
      typewriterCursorBlink(frame);
    const cursorPose =
      lastVisible >= 0
        ? (arcLayout.glyphs[start + lastVisible + 1] ??
          arcLayout.glyphs[start + lastVisible])
        : null;

    return (
      <>
        {glyphs.map((ch, i) => {
          if (
            typewriter &&
            !typewriterLetterVisible(word, i, glyphs.length, frame)
          ) {
            return null;
          }
          const pose = arcLayout.glyphs[start + i];
          if (!pose) return null;
          return (
            <span
              key={i}
              style={{
                position: "absolute",
                left: pose.x,
                top: pose.y,
                transform: `translate(-50%, -100%) rotate(${pose.rotate}deg)`,
                transformOrigin: "center bottom",
                whiteSpace: "pre",
                ...(silhouette
                  ? {
                      opacity: visual.opacity > 0 ? 1 : 0,
                      color: "transparent",
                      WebkitTextFillColor: "transparent",
                    }
                  : {
                      opacity: visual.opacity,
                      ...visual.wordCss,
                    }),
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
              position: "absolute",
              left: cursorPose.x,
              top: cursorPose.y,
              transform: `translate(-50%, -100%) rotate(${cursorPose.rotate}deg)`,
              transformOrigin: "center bottom",
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

  const content = letterReveal
    ? Array.from(word.text).map((ch, i) => {
        if (!typewriterLetterVisible(word, i, word.text.length, frame)) {
          return null;
        }
        return <React.Fragment key={i}>{ch}</React.Fragment>;
      })
    : word.text;

  const showCursor =
    !silhouette &&
    typewriter &&
    frame < groupEndFrame &&
    lastVisibleWordIndex(words, frame, false) === index &&
    typewriterCursorBlink(frame);

  if (silhouette) {
    return (
      <span
        style={{
          display: "inline-block",
          whiteSpace: whitespace ? "pre" : undefined,
          opacity: visual.opacity > 0 ? 1 : 0,
          color: "transparent",
          WebkitTextFillColor: "transparent",
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
