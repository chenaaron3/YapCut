import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

import { EnterExit } from "./EnterExit";
import { Wipe } from "./Wipe";

import type { CaptionGroupAnimation } from "~/remotion/captions/style";

function paintChild(children: ReactNode, silhouette?: boolean): ReactNode {
  if (!silhouette) return children;
  const child = Children.count(children) === 1 ? Children.only(children) : null;
  if (child && isValidElement(child)) {
    return cloneElement(child as ReactElement<{ silhouette?: boolean }>, {
      silhouette: true,
    });
  }
  return children;
}

export type AnimationMountProps = {
  animation: CaptionGroupAnimation;
  frame: number;
  startFrame: number;
  endFrame: number;
  fps: number;
  as?: "div" | "span";
  silhouette?: boolean;
  children: ReactNode;
};

/**
 * Motion registry for group or word. New wrapper → new entry.
 * Fade/scale/slide/bounce/spin → EnterExit; wipe → Wipe; none → children.
 * Typewriter is `wordReveal` in CaptionWordSpan. Arc is layout, not an entry.
 *
 * ContourBoard clones this node with `silhouette`; none forwards that onto
 * CaptionWordSpan, wipe/enter skip motion and do the same.
 */
export function AnimationMount({
  animation,
  frame,
  startFrame,
  endFrame,
  fps,
  as = "div",
  silhouette,
  children,
}: AnimationMountProps) {
  if (animation === "none") {
    return paintChild(children, silhouette);
  }
  if (animation === "wipe") {
    return (
      <Wipe
        frame={frame}
        startFrame={startFrame}
        endFrame={endFrame}
        fps={fps}
        as={as}
        silhouette={silhouette}
      >
        {children}
      </Wipe>
    );
  }
  return (
    <EnterExit
      animation={animation}
      frame={frame}
      startFrame={startFrame}
      endFrame={endFrame}
      fps={fps}
      as={as}
      silhouette={silhouette}
    >
      {children}
    </EnterExit>
  );
}
