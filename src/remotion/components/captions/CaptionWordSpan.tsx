import React, { useContext } from "react";

import {
  arcGlyphBoxStyle,
  ArcLayoutContext,
  wordGlyphOffset,
} from "./arc-layout";
import { transformCaptionWord } from "./caption-style-css";
import {
  resolveCaptionWordVisual,
  typewriterLetterVisible,
} from "./caption-word-visual";
import { ScribbleWordFrame } from "./ScribbleMark";

import type { ArcLayout } from "./arc-layout";
import type { CaptionWordVisual } from "./caption-word-visual";
import type { ResolvedEmphasisStyle } from "~/domain/transcript/emphasis-style";
import type { CaptionGroupStyle } from "~/remotion/captions/style";
import type { CaptionWordProp } from "~/remotion/helpers/types";
import type { CSSProperties } from "react";

function isWhitespaceWord(text: string): boolean {
  return /^\s+$/.test(text);
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
  words,
  index,
  frame,
  groupStyle,
  visual,
  silhouette,
  typewriter,
  arc,
}: {
  word: CaptionWordProp;
  words: CaptionWordProp[];
  index: number;
  frame: number;
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

  return (
    <>
      {glyphs.map((ch, i) => {
        const pose = arc.glyphs[start + i];
        if (!pose) return null;
        const letterVisible =
          !typewriter || typewriterLetterVisible(word, i, glyphs.length, frame);
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
        words={words}
        index={index}
        frame={frame}
        groupStyle={groupStyle}
        visual={visual}
        silhouette={silhouette}
        typewriter={typewriter}
        arc={arc}
      />
    );
  }

  const glyphs = Array.from(word.text);
  const letterReveal = typewriter && glyphs.length > 0 && !whitespace;
  const content = letterReveal
    ? glyphs.map((ch, i) => (
        <span
          key={i}
          style={{
            visibility: typewriterLetterVisible(word, i, glyphs.length, frame)
              ? "visible"
              : "hidden",
            whiteSpace: "pre",
          }}
        >
          {ch}
        </span>
      ))
    : word.text;

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
    <ScribbleWordFrame
      word={word}
      color={emphasisStyle?.fill ?? ""}
      frame={frame}
      fps={fps}
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
    </ScribbleWordFrame>
  );
};
