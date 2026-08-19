import { Sequence, useCurrentFrame, useVideoConfig } from "remotion";

import { MotionGraphic } from "~/remotion/components/motion/MotionGraphic";

import type { MotionOverlayProp } from "~/remotion/helpers/types";

function MotionItem({ overlay }: { overlay: MotionOverlayProp }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <MotionGraphic
      overlay={overlay}
      frame={overlay.startFrame + frame}
      fps={fps}
      measure
    />
  );
}

export function MotionLayer({ overlays }: { overlays: MotionOverlayProp[] }) {
  return (
    <>
      {overlays.map((overlay) => {
        const durationInFrames = Math.max(
          1,
          overlay.endFrame - overlay.startFrame,
        );
        return (
          <Sequence
            key={overlay.id}
            from={overlay.startFrame}
            durationInFrames={durationInFrames}
            layout="none"
          >
            <MotionItem overlay={overlay} />
          </Sequence>
        );
      })}
    </>
  );
}
