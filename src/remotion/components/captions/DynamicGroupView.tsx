import React from "react";

import { DEFAULT_CAPTION_STYLE } from "~/remotion/captions/style";
import type { CaptionGroupProp } from "~/remotion/types";

import { CaptionGroupLayout } from "./CaptionGroupLayout";
import { CaptionWordSpan } from "./CaptionWordSpan";

/**
 * Per-word enter/exit + past/active/future styles (captions / quotes).
 * Typewriter letter reveal lives inside {@link CaptionWordSpan}.
 */
export const DynamicGroupView: React.FC<{
  group: CaptionGroupProp;
  frame: number;
  fps: number;
}> = ({ group, frame, fps }) => {
  const style = group.style ?? DEFAULT_CAPTION_STYLE;

  return (
    <CaptionGroupLayout group={group}>
      {group.words.map((word, index) => (
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
          animateWord
          cycleWordStates
        />
      ))}
    </CaptionGroupLayout>
  );
};
