import {
  Children,
  cloneElement,
  isValidElement,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";

import { resolveEnterExitMotion } from "./caption-animation";

import type { CaptionGroupAnimation } from "~/remotion/captions/style";

export type EnterExitProps = {
  animation: CaptionGroupAnimation;
  frame: number;
  startFrame: number;
  endFrame: number;
  fps: number;
  as?: "div" | "span";
  silhouette?: boolean;
  children: ReactNode;
};

function paintChild(children: ReactNode, silhouette?: boolean): ReactNode {
  const child = Children.count(children) === 1 ? Children.only(children) : null;
  if (silhouette && child && isValidElement(child)) {
    return cloneElement(child as ReactElement<{ silhouette?: boolean }>, {
      silhouette: true,
    });
  }
  return children;
}

/** Fade / scale / slide / bounce / spin on one node. Wipe is the other AnimationMount entry. */
export function EnterExit({
  animation,
  frame,
  startFrame,
  endFrame,
  fps,
  as: Tag = "div",
  silhouette = false,
  children,
}: EnterExitProps) {
  const painted = paintChild(children, silhouette);
  if (silhouette) {
    return (
      <Tag style={{ display: Tag === "span" ? "inline-block" : undefined }}>
        {painted}
      </Tag>
    );
  }
  const motion = resolveEnterExitMotion({
    animation,
    frame,
    startFrame,
    endFrame,
    fps,
  });
  const transform = [
    motion.scale !== 1 ? `scale(${motion.scale})` : "",
    motion.translateY !== 0 ? `translateY(${motion.translateY}px)` : "",
    motion.rotate !== 0 ? `rotate(${motion.rotate}deg)` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const style: CSSProperties = {
    display: Tag === "span" ? "inline-block" : undefined,
    opacity: motion.opacity,
    transform: transform || undefined,
  };
  return <Tag style={style}>{painted}</Tag>;
}
