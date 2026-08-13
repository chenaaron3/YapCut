import type { CaptionGroupStyle } from "~/remotion/captions/style";

export const PREVIEW_FPS = 30;
export const WORD_STAGGER_FRAMES = 7;
export const HOLD_FRAMES = 18;
export const GAP_FRAMES = 8;

/** Focus band inside the scaled composition (matches caption safe framing). */
export const PREVIEW_SAFE_TOP = 0.12;
export const PREVIEW_SAFE_BOTTOM = 0.22;

export type OverlayPreviewPair = {
  heading: CaptionGroupStyle;
  subheading: CaptionGroupStyle;
  stacked: boolean;
  headingText: string;
  subheadingText: string;
  staggered: boolean;
};

export function captionFocusY(styleY: number): number {
  const safeH = 1 - PREVIEW_SAFE_TOP - PREVIEW_SAFE_BOTTOM;
  return PREVIEW_SAFE_TOP + (0.5 + 0.5 * styleY) * safeH;
}

export function overlayFocusY(offsetY: number): number {
  return 0.5 + offsetY;
}

export const OVERLAY_PREVIEW_MIDDLE = 28;
export const OVERLAY_PREVIEW_END = 70;
export const OVERLAY_PREVIEW_CYCLE = OVERLAY_PREVIEW_END + 12;
export const OVERLAY_PREVIEW_IDLE_FRAME = OVERLAY_PREVIEW_END - 1;
