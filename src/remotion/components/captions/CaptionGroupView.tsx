import React from "react";

import { captionWordAnimation, DEFAULT_CAPTION_STYLE } from "~/remotion/captions/style";

import { AnimationMount } from "./AnimationMount";
import { isLineBreakToken } from "./caption-animation";
import { CaptionGroupLayout, CaptionLineBreak } from "./CaptionGroupLayout";
import { CaptionWordSpan } from "./CaptionWordSpan";

import type { CaptionGroupProp } from "~/remotion/helpers/types";

/**
 * One timed group: group motion → layout → words.
 * World placement is CaptionWorldFrame (captions/quotes) or the overlay transform.
 *
 * `cycleWordStates`: captions/quotes cycle past/active/future; overlay is false
 * (group AnimationMount owns enter, words stay in layout).
 * Typewriter is `wordReveal` on the span, not a word wrapper.
 * Captions/quotes: word wrappers enter at the word, hold until the group
 * ends so past words stay on screen.
 */
export function CaptionGroupView({
  group,
  frame,
  fps,
  cycleWordStates,
}: {
  group: CaptionGroupProp;
  frame: number;
  fps: number;
  cycleWordStates: boolean;
}) {
  const style = group.style ?? DEFAULT_CAPTION_STYLE;

  return (
    <AnimationMount
      animation={style.groupAnimation}
      frame={frame}
      startFrame={group.startFrame}
      endFrame={group.endFrame}
      fps={fps}
    >
      <CaptionGroupLayout group={group}>
        {group.words.map((word, index) =>
          isLineBreakToken(word.text) ? (
            <CaptionLineBreak key={`${word.startFrame}-br-${index}`} />
          ) : (
            <AnimationMount
              key={`${word.startFrame}-${word.text}-${index}`}
              animation={captionWordAnimation(style)}
              frame={frame}
              startFrame={word.startFrame}
              endFrame={
                cycleWordStates ? group.endFrame : word.endFrame
              }
              fps={fps}
              as="span"
            >
              <CaptionWordSpan
                word={word}
                index={index}
                words={group.words}
                frame={frame}
                fps={fps}
                groupStartFrame={group.startFrame}
                groupEndFrame={group.endFrame}
                groupStyle={style}
                emphasisStyle={group.emphasisStyle}
                cycleWordStates={cycleWordStates}
              />
            </AnimationMount>
          ),
        )}
      </CaptionGroupLayout>
    </AnimationMount>
  );
}
