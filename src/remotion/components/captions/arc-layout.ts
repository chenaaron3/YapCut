/** Glyph poses for `style.arc`. Layout only — CaptionWordSpan paints them. */
import { createContext, type CSSProperties } from "react";

import {
  captionArc,
  resolveCaptionFont,
  type CaptionGroupStyle,
} from "~/remotion/captions/style";
import type { CaptionGroupProp, CaptionWordProp } from "~/remotion/helpers/types";

import { isLineBreakToken } from "./caption-animation";
import { transformCaptionWord } from "./caption-style-css";

export type ArcGlyphPose = {
  x: number;
  y: number;
  /** Tangent in degrees. */
  rotate: number;
};

export type ArcLayout = {
  width: number;
  height: number;
  glyphs: ArcGlyphPose[];
};

export const ArcLayoutContext = createContext<ArcLayout | null>(null);

/** Bottom-center of the glyph sits on the circle at `(x, y)`. */
export function arcGlyphBoxStyle(pose: ArcGlyphPose): CSSProperties {
  return {
    position: "absolute",
    left: pose.x,
    top: pose.y,
    transform: `translate(-50%, -100%) rotate(${pose.rotate}deg)`,
    transformOrigin: "center bottom",
  };
}

/** Flatten group words to glyphs (inter-word spaces included; line breaks → space). */
export function flattenGroupGlyphs(
  words: readonly CaptionWordProp[],
  style: CaptionGroupStyle,
): string[] {
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    if (isLineBreakToken(word.text)) {
      out.push(" ");
      continue;
    }
    out.push(
      ...Array.from(transformCaptionWord(word.text, style.textTransform)),
    );
    const next = words[i + 1];
    if (next && !isLineBreakToken(word.text) && !isLineBreakToken(next.text)) {
      out.push(" ");
    }
  }
  return out;
}

/** Index of this word's first glyph in the flattened pose array. */
export function wordGlyphOffset(
  words: readonly CaptionWordProp[],
  wordIndex: number,
  style: CaptionGroupStyle,
): number {
  if (wordIndex <= 0) return 0;
  return (
    flattenGroupGlyphs(words, style).length -
    flattenGroupGlyphs(words.slice(wordIndex), style).length
  );
}

function cssFont(style: CaptionGroupStyle): string {
  const face = resolveCaptionFont(style.fontFamily);
  return `${style.fontStyle} ${face.weight} ${style.fontSize}px ${face.family}`;
}

function measureText(text: string, style: CaptionGroupStyle): number {
  const fallback = Math.max(1, text.length) * style.fontSize * 0.5;
  if (typeof document === "undefined") return fallback;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return fallback;
  ctx.font = cssFont(style);
  const width = ctx.measureText(text).width;
  return Number.isFinite(width) && width > 0 ? width : fallback;
}

/**
 * CapCut-style glyph curve. |arc| 100 = semicircle.
 * Positive = rainbow (up in the middle); negative = frown.
 * Glyph centers sit on the circle; `rotate` is the tangent in degrees.
 */
export function layoutCaptionArc(
  group: CaptionGroupProp,
  style: CaptionGroupStyle,
): ArcLayout | null {
  const arc = captionArc(style);
  const glyphs = flattenGroupGlyphs(group.words, style);
  if (arc === 0 || glyphs.length === 0) return null;

  const cumWidth: number[] = [0];
  for (let i = 1; i <= glyphs.length; i++) {
    cumWidth.push(measureText(glyphs.slice(0, i).join(""), style));
  }
  const total = cumWidth[glyphs.length]!;
  const bend = Math.abs(arc) / 100;
  const sweepRad = Math.max(0.12, bend * Math.PI);
  const radius = total / sweepRad;
  const halfSweep = sweepRad / 2;
  const sagitta = radius * (1 - Math.cos(halfSweep));
  const fontSize = style.fontSize;
  const padX = fontSize * 0.7;
  const padTop = fontSize * 1.25;
  const padBot = fontSize * 0.35;
  const width = 2 * radius * Math.sin(halfSweep) + padX * 2;
  const height = sagitta + padTop + padBot;
  const rainbow = arc >= 0;
  const cx = width / 2;
  const cy = rainbow
    ? padTop + radius
    : padTop + sagitta - radius * Math.cos(halfSweep);

  const poses: ArcGlyphPose[] = glyphs.map((_, i) => {
    const center = (cumWidth[i]! + cumWidth[i + 1]!) / 2;
    const theta = (center - total / 2) / radius;
    return {
      x: cx + radius * Math.sin(theta),
      y: rainbow
        ? cy - radius * Math.cos(theta)
        : cy + radius * Math.cos(theta),
      rotate: ((rainbow ? theta : -theta) * 180) / Math.PI,
    };
  });

  return { width, height, glyphs: poses };
}
