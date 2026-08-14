import { useCurrentFrame, useVideoConfig } from "remotion";

import { CaptionWorldFrame } from "~/remotion/components/captions/CaptionWorldFrame";
import { CompositeGroupLayout } from "~/remotion/components/captions/CompositeGroupLayout";
import { DEFAULT_CAPTION_STYLE } from "~/remotion/captions/style";

import type { CaptionGroupProp } from "~/remotion/helpers/types";

/** Captions and quotes: safe-area world + one stacked group. */
export function Captions({ groups }: { groups: CaptionGroupProp[] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const active = groups.find(
    (group) => frame >= group.startFrame && frame < group.endFrame,
  );

  if (!active) return null;

  const style = active.style ?? DEFAULT_CAPTION_STYLE;
  const layoutKey = `${active.words.map((w) => w.text).join(" ")}\0${style.y}\0${style.fontSize}\0${style.background.kind}`;

  return (
    <CaptionWorldFrame y={style.y} measure layoutKey={layoutKey}>
      <CompositeGroupLayout
        layout="stack"
        fps={fps}
        items={[
          {
            group: active,
            localY: 0,
            cycleWordStates: true,
            frame,
          },
        ]}
      />
    </CaptionWorldFrame>
  );
}
