import type { CaptionGroupStyle } from "~/remotion/captions/style";

export const PREVIEW_FPS = 30;
export const WORD_STAGGER_FRAMES = 7;
export const HOLD_FRAMES = 18;
export const GAP_FRAMES = 8;

/** Focus band inside the scaled composition (matches caption safe framing). */
export const PREVIEW_SAFE_TOP = 0.12;
export const PREVIEW_SAFE_BOTTOM = 0.22;

export type ListiclePreviewPair = {
  indicator: CaptionGroupStyle;
  value: CaptionGroupStyle;
  stacked: boolean;
};

export function captionFocusY(styleY: number): number {
  return (
    PREVIEW_SAFE_TOP +
    styleY * (1 - PREVIEW_SAFE_TOP - PREVIEW_SAFE_BOTTOM)
  );
}
