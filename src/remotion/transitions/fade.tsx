import type { CSSProperties } from "react";
import { useCurrentFrame } from "remotion";

import type { TransitionClipProp } from "~/remotion/helpers/types";
import { clipProgress } from "~/remotion/transitions/progress";
import { StitchOverlay } from "~/remotion/transitions/stitch-overlay";
import type { TransitionPainter } from "~/remotion/transitions/types";

const HIDDEN: CSSProperties = { backfaceVisibility: "hidden" };

function FadeOverlay({ clip }: { clip: TransitionClipProp }) {
  const frame = useCurrentFrame();
  if (clip.mode !== "interior") return null;
  const duration = Math.max(1, clip.endFrame - clip.startFrame);
  const p = clipProgress(frame, duration);
  return (
    <StitchOverlay
      clip={clip}
      outStyle={{ ...HIDDEN, opacity: 1 - p }}
      inStyle={{ ...HIDDEN, opacity: p }}
    />
  );
}

export const fadePainter: TransitionPainter = {
  pictureStyle: (p, mode) => ({
    ...HIDDEN,
    opacity: mode === "opening" ? p : 1 - p,
  }),
  Overlay: FadeOverlay,
};
