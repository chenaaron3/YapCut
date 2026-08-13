import React, { type CSSProperties } from "react";

import { DEFAULT_CAPTION_STYLE } from "~/remotion/captions/style";
import type { CaptionGroupProp } from "~/remotion/helpers/types";

import { resolveEnterExitMotion } from "./caption-animation";
import {
  CaptionGroupLayout,
  CaptionLineBreak,
} from "./CaptionGroupLayout";
import { CaptionWordSpan } from "./CaptionWordSpan";
import { isLineBreakToken } from "./static-group";

/**
 * Group-level enter/exit; words paint active style (text VFX).
 * Typewriter staggers via word timings + letter reveal in {@link CaptionWordSpan}.
 */
export const StaticGroupView: React.FC<{
  group: CaptionGroupProp;
  frame: number;
  fps: number;
  /** Flow layout for stacked caption pairs (no absolute Y). */
  embedded?: boolean;
}> = ({ group, frame, fps, embedded = false }) => {
  const style = group.style ?? DEFAULT_CAPTION_STYLE;
  const animation = style.animation;

  const groupMotion = resolveEnterExitMotion({
    animation: animation === "typewriter" ? "none" : animation,
    frame,
    startFrame: group.startFrame,
    endFrame: group.endFrame,
    fps,
  });

  const shellStyle: CSSProperties = {
    opacity: groupMotion.opacity,
    transform: [
      !embedded ? "translateY(-50%)" : "",
      groupMotion.scale !== 1 ? `scale(${groupMotion.scale})` : "",
      groupMotion.translateY !== 0
        ? `translateY(${groupMotion.translateY}px)`
        : "",
    ]
      .filter(Boolean)
      .join(" "),
  };

  return (
    <CaptionGroupLayout
      group={group}
      shellStyle={shellStyle}
      embedded={embedded}
    >
      {group.words.map((word, index) =>
        isLineBreakToken(word.text) ? (
          <CaptionLineBreak key={`${word.startFrame}-br-${index}`} />
        ) : (
          <CaptionWordSpan
            key={`${word.startFrame}-${word.text}-${index}`}
            word={word}
            index={index}
            words={group.words}
            frame={frame}
            fps={fps}
            groupStartFrame={group.startFrame}
            groupEndFrame={group.endFrame}
            groupStyle={style}
            emphasisStyle={group.emphasisStyle}
            animateWord={false}
            cycleWordStates={false}
          />
        ),
      )}
    </CaptionGroupLayout>
  );
};
