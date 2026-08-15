import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { PREMOUNT_SEC } from "~/remotion/helpers/constants";
import { clipProgress, openCloseProgress } from "~/remotion/transitions/progress";
import { TRANSITION_PAINTERS } from "~/remotion/transitions/registry";

import type { TransitionClipProp } from "~/remotion/helpers/types";

function pictureStackStyle(
  frame: number,
  transitions: readonly TransitionClipProp[],
): CSSProperties {
  let style: CSSProperties = { backfaceVisibility: "hidden" };
  for (const clip of transitions) {
    const painter = TRANSITION_PAINTERS[clip.templateId];
    if (!painter.pictureStyle) continue;
    if (clip.mode === "interior") {
      if (frame < clip.startFrame || frame >= clip.endFrame) continue;
      const duration = Math.max(1, clip.endFrame - clip.startFrame);
      const p = clipProgress(frame - clip.startFrame, duration, painter.ease);
      style = { ...style, ...painter.pictureStyle(p, "interior") };
      continue;
    }
    const p = openCloseProgress(
      frame,
      clip.startFrame,
      clip.endFrame,
      painter.ease,
    );
    if (p == null) continue;
    style = painter.pictureStyle(p, clip.mode);
  }
  return style;
}

function OverlayClip({ clip }: { clip: TransitionClipProp }) {
  const Overlay = TRANSITION_PAINTERS[clip.templateId].Overlay;
  return <Overlay clip={clip} />;
}

/**
 * Single picture-stack blanket: open/close motion on children, then one
 * Overlay per clip from {@link TRANSITION_PAINTERS}.
 */
export function TransitionLayer({
  transitions,
  children,
}: {
  transitions: TransitionClipProp[];
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const premountFor = Math.round(PREMOUNT_SEC * fps);
  const style = pictureStackStyle(frame, transitions);

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#000" }}>
      <AbsoluteFill style={style}>{children}</AbsoluteFill>
      {transitions.map((clip) => (
        <Sequence
          key={clip.id}
          from={clip.startFrame}
          durationInFrames={Math.max(1, clip.endFrame - clip.startFrame)}
          premountFor={premountFor}
        >
          <OverlayClip clip={clip} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
