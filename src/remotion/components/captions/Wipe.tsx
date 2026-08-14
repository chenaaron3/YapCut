import {
  Children,
  cloneElement,
  isValidElement,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { interpolate } from "remotion";

import { enterFramesFor, shouldSkipMotion } from "./caption-animation";

function paintChild(children: ReactNode, silhouette?: boolean): ReactNode {
  const child = Children.count(children) === 1 ? Children.only(children) : null;
  if (silhouette && child && isValidElement(child)) {
    return cloneElement(child as ReactElement<{ silhouette?: boolean }>, {
      silhouette: true,
    });
  }
  return children;
}

export function Wipe({
  frame,
  startFrame,
  endFrame,
  fps,
  as: Tag = "div",
  silhouette = false,
  children,
}: {
  frame: number;
  startFrame: number;
  endFrame: number;
  fps: number;
  as?: "div" | "span";
  silhouette?: boolean;
  children: ReactNode;
}) {
  const painted = paintChild(children, silhouette);
  if (silhouette) {
    return (
      <Tag style={{ display: Tag === "span" ? "inline-block" : undefined }}>
        {painted}
      </Tag>
    );
  }

  const enterFrames = enterFramesFor(fps);
  const duration = Math.max(1, endFrame - startFrame);
  const skip = shouldSkipMotion(duration, enterFrames);
  const local = frame - startFrame;

  let reveal = 1;
  if (!skip && frame >= startFrame && frame < endFrame) {
    if (local < enterFrames) {
      reveal = interpolate(local, [0, enterFrames], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    }
  } else if (frame < startFrame || frame >= endFrame) {
    reveal = 0;
  }

  const style: CSSProperties = {
    display: Tag === "span" ? "inline-block" : undefined,
    overflow: "hidden",
    clipPath: `inset(0 ${(1 - reveal) * 100}% 0 0)`,
  };
  return <Tag style={style}>{painted}</Tag>;
}
