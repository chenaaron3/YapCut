import { useMemo } from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";

import { buildStaticGroup } from "~/remotion/components/captions/static-group";
import { StaticGroupView } from "~/remotion/components/captions/StaticGroupView";
import { SAFE_AREA } from "~/remotion/constants";
import { resolveTextVfxStyle } from "~/remotion/text/resolve";
import type { TextOverlayProp } from "~/remotion/types";

function TextOverlayItem({ overlay }: { overlay: TextOverlayProp }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = resolveTextVfxStyle(overlay.style);
  const durationFrames = Math.max(1, overlay.endFrame - overlay.startFrame);

  const group = useMemo(
    () => buildStaticGroup(overlay.text, style, fps, durationFrames),
    [overlay.text, style, fps, durationFrames],
  );

  if (frame >= durationFrames) return null;

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        top: SAFE_AREA.top,
        bottom: SAFE_AREA.bottom,
        left: SAFE_AREA.left,
        right: SAFE_AREA.right,
        width: "auto",
        height: "auto",
      }}
    >
      <StaticGroupView group={group} frame={frame} fps={fps} />
    </AbsoluteFill>
  );
}

export function TextOverlay({ overlays }: { overlays: TextOverlayProp[] }) {
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
            <TextOverlayItem overlay={overlay} />
          </Sequence>
        );
      })}
    </>
  );
}
