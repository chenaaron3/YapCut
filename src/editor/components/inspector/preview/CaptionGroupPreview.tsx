import { GAP_FRAMES, HOLD_FRAMES, PREVIEW_FPS, WORD_STAGGER_FRAMES } from "~/editor/components/inspector/preview/constants";
import { groupCaptionWords } from "~/remotion/captions/words";
import { CaptionWorldFrame } from "~/remotion/components/captions/CaptionWorldFrame";
import { CompositeGroupLayout } from "~/remotion/components/captions/CompositeGroupLayout";
import { DEFAULT_CAPTION_STYLE } from "~/remotion/captions/style";
import type { CaptionGroupStyle } from "~/remotion/captions/style";
import type { CaptionGroupProp, CaptionWordProp } from "~/remotion/helpers/types";

const PREVIEW_PHRASES = [
  ["This", "is", "a", "caption"],
  ["Watch", "what", "happens", "next"],
  ["Keep", "going"],
] as const;

function groupDuration(wordCount: number): number {
  return Math.max(1, (wordCount - 1) * WORD_STAGGER_FRAMES + HOLD_FRAMES);
}

export function buildCaptionPreviewGroups(
  style: CaptionGroupStyle,
): CaptionGroupProp[] {
  let cursor = 0;
  const groups: CaptionGroupProp[] = [];

  for (const phrase of PREVIEW_PHRASES) {
    const provisional: CaptionWordProp[] = phrase.map((text, i) => ({
      text,
      startFrame: i,
      endFrame: i + 1,
    }));
    const batches = groupCaptionWords(provisional, style.captionsAtATime);

    for (const batch of batches) {
      const startFrame = cursor;
      const words: CaptionWordProp[] = batch.words.map((word, i) => {
        const wordStart = startFrame + i * WORD_STAGGER_FRAMES;
        return {
          text: word.text,
          startFrame: wordStart,
          endFrame: wordStart + WORD_STAGGER_FRAMES,
        };
      });
      const endFrame = startFrame + groupDuration(words.length);
      cursor = endFrame + GAP_FRAMES;
      groups.push({
        words,
        startFrame,
        endFrame,
        captionsAtATime: style.captionsAtATime,
        style,
      });
    }
  }

  return groups;
}

export function captionPreviewCycle(groups: CaptionGroupProp[]): {
  cycleLen: number;
  idleFrame: number;
} {
  const last = groups[groups.length - 1];
  return {
    cycleLen: last ? last.endFrame + GAP_FRAMES : 1,
    idleFrame: Math.max(0, (groups[0]?.endFrame ?? 1) - 1),
  };
}

/** Same Composite + world path as export captions/quotes. */
export function CaptionGroupPreview({
  groups,
  frame,
}: {
  groups: CaptionGroupProp[];
  frame: number;
}) {
  const active = groups.find(
    (group) => frame >= group.startFrame && frame < group.endFrame,
  );

  if (!active) return null;

  const style = active.style ?? DEFAULT_CAPTION_STYLE;

  return (
    <CaptionWorldFrame y={style.y} layoutKey={frame}>
      <CompositeGroupLayout
        layout="stack"
        fps={PREVIEW_FPS}
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
