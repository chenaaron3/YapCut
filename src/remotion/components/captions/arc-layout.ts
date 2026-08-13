import { createContext } from "react";

import {
  captionArc,
  resolveCaptionFont,
  type CaptionGroupStyle,
  type CaptionTextTransform,
} from "~/remotion/captions/style";
import type { CaptionGroupProp, CaptionWordProp } from "~/remotion/helpers/types";

import { isLineBreakToken } from "./caption-animation";

export type ArcGlyphPose = {
  x: number;
  y: number;
  rotate: number;
};

export type ArcLayout = {
  width: number;
  height: number;
  glyphs: ArcGlyphPose[];
};

export const ArcLayoutContext = createContext<ArcLayout | null>(null);

export function transformCaptionWord(
  text: string,
  transform: CaptionTextTransform,
): string {
  if (transform === "uppercase") return text.toUpperCase();
  if (transform === "lowercase") return text.toLowerCase();
  if (transform === "capitalize") {
    const lower = text.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }
  return text;
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
 * CapCut-style curve: |arc| 100 = semicircle. Glyph centers sit on the
 * circle; rotate is the tangent (degrees).
 */
export function layoutCaptionArc(
  group: CaptionGroupProp,
  style: CaptionGroupStyle,
): ArcLayout | null {
  const arc = captionArc(style);
  const glyphs = flattenGroupGlyphs(group.words, style);
  if (arc === 0 || glyphs.length === 0) return null;

  const prefixes: number[] = [0];
  for (let i = 1; i <= glyphs.length; i++) {
    prefixes.push(measureText(glyphs.slice(0, i).join(""), style));
  }
  const total = prefixes[glyphs.length]!;
  const t = Math.abs(arc) / 100;
  const sweepRad = Math.max(0.12, t * Math.PI);
  const radius = total / sweepRad;
  const alpha = sweepRad / 2;
  const sagitta = radius * (1 - Math.cos(alpha));
  const fontSize = style.fontSize;
  const padX = fontSize * 0.7;
  const padTop = fontSize * 1.25;
  const padBot = fontSize * 0.35;
  const width = 2 * radius * Math.sin(alpha) + padX * 2;
  const height = sagitta + padTop + padBot;
  const smile = arc >= 0;
  const cx = width / 2;
  const cy = smile
    ? padTop + radius
    : padTop + sagitta - radius * Math.cos(alpha);

  const poses: ArcGlyphPose[] = glyphs.map((_, i) => {
    const center = (prefixes[i]! + prefixes[i + 1]!) / 2;
    const theta = (center - total / 2) / radius;
    return {
      x: cx + radius * Math.sin(theta),
      y: smile
        ? cy - radius * Math.cos(theta)
        : cy + radius * Math.cos(theta),
      rotate: ((smile ? theta : -theta) * 180) / Math.PI,
    };
  });

  return { width, height, glyphs: poses };
}
