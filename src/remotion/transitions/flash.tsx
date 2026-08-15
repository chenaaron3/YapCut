import type { CSSProperties } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

import type { TransitionClipProp } from "~/remotion/helpers/types";
import { TRANSITION_EASE } from "~/remotion/transitions/progress";
import type { TransitionPainter } from "~/remotion/transitions/types";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export function flashPeakFromProgress(
  p: number,
  mode: TransitionClipProp["mode"],
): number {
  const raw =
    mode === "opening"
      ? 1 - p
      : mode === "closing"
        ? p
        : p <= 0.5
          ? p * 2
          : (1 - p) * 2;
  return Math.max(0, Math.min(1, raw));
}

export function flashPeak01(
  frame: number,
  last: number,
  mode: TransitionClipProp["mode"],
): number {
  const t =
    last <= 0
      ? 1
      : interpolate(frame, [0, last], [0, 1], {
          ...CLAMP,
          easing: TRANSITION_EASE,
        });
  return flashPeakFromProgress(t, mode);
}

/** CapCut bleach: lift the picture, crush remaining contrast, slight bloom blur. */
export function flashPictureStyle(
  peak: number,
  extraBlurPx = 0,
): CSSProperties {
  const brightness = 1 + 2.6 * peak;
  const contrast = 1 - 0.38 * peak;
  const saturate = 1 - 0.42 * peak;
  const blur = 2.4 * peak + extraBlurPx;
  return {
    backfaceVisibility: "hidden",
    filter: `brightness(${brightness}) contrast(${contrast}) saturate(${saturate})${
      blur > 0.06 ? ` blur(${blur}px)` : ""
    }`,
  };
}

/**
 * Additive bloom on top of the bleached picture.
 * Center hotspot first; edges wash white only near the stitch (hides the cut).
 */
export function FlashBurst({ peak }: { peak: number }) {
  if (peak <= 0.003) return null;
  const hotspot = peak ** 0.85;
  const edgeWash = peak ** 2.2;
  const cutHide = Math.max(0, (peak - 0.82) / 0.18) ** 1.1;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          mixBlendMode: "screen",
          opacity: hotspot,
          background:
            "radial-gradient(ellipse 72% 60% at 50% 40%, #fff 0%, rgba(255,252,245,0.7) 24%, rgba(255,236,210,0.28) 52%, rgba(255,255,255,0) 78%)",
        }}
      />
      <AbsoluteFill
        style={{
          mixBlendMode: "plus-lighter",
          opacity: edgeWash * 0.9,
          background:
            "radial-gradient(ellipse 100% 100% at 50% 50%, rgba(255,255,255,0.15) 0%, rgba(255,250,245,0.55) 48%, #fff 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundColor: "#fffaf2",
          opacity: cutHide,
        }}
      />
    </AbsoluteFill>
  );
}

export const flashPainter: TransitionPainter = {
  ease: TRANSITION_EASE,
  Overlay: ({ clip }) => {
    const frame = useCurrentFrame();
    const last = Math.max(1, clip.endFrame - clip.startFrame - 1);
    return <FlashBurst peak={flashPeak01(frame, last, clip.mode)} />;
  },
  pictureStyle: (p, mode) => flashPictureStyle(flashPeakFromProgress(p, mode)),
};
