import {
  captionFontCss,
  wordStyleToCss,
} from "~/remotion/components/captions/caption-style-css";

import type { CSSProperties } from "react";
import type { CaptionGroupStyle } from "~/remotion/captions/style";

export type MotionLook = {
  fill: string;
  font: CSSProperties;
  paint: CSSProperties;
};

export function motionLook(style: CaptionGroupStyle): MotionLook {
  return {
    fill: style.wordStyle.fill,
    font: {
      ...captionFontCss(style.fontFamily),
      fontSize: style.fontSize,
    },
    paint: wordStyleToCss(style.wordStyle),
  };
}

export function seriesColors(
  fill: string,
  extras: readonly string[] | null | undefined,
  count: number,
): string[] {
  const ramp = extras?.length
    ? [...extras]
    : [fill, "#5c5c5c", "#326fa8", "#c45c26", "#2a9d8f"];
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(ramp[i % ramp.length]!);
  }
  return out;
}
