import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

import { DynamicGroupView } from "~/remotion/components/captions/DynamicGroupView";
import { SAFE_AREA } from "~/remotion/helpers/constants";

import type { CaptionGroupProp } from "~/remotion/helpers/types";

/** Player/export captions — full DynamicGroupView stack. */
export function Captions({ groups }: { groups: CaptionGroupProp[] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const active = groups.find(
    (group) => frame >= group.startFrame && frame < group.endFrame,
  );

  if (!active) return null;

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
      <DynamicGroupView group={active} frame={frame} fps={fps} measure />
    </AbsoluteFill>
  );
}
