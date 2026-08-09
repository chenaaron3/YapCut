import { AbsoluteFill } from "remotion";

import {
  GAP_FRAMES,
  HOLD_FRAMES,
  PREVIEW_FPS,
  WORD_STAGGER_FRAMES,
} from "~/editor/components/inspector/preview/constants";
import { groupCaptionWords } from "~/remotion/captions/words";
import type { CaptionGroupStyle } from "~/remotion/captions/style";
import { DynamicGroupView } from "~/remotion/components/captions/DynamicGroupView";
import { StaticGroupView } from "~/remotion/components/captions/StaticGroupView";
import { SAFE_AREA } from "~/remotion/constants";
import type { CaptionGroupProp, CaptionWordProp } from "~/remotion/types";

/** Fixed sample phrases — CSS textTransform handles case. */
const PREVIEW_PHRASES = [
  ["This", "is", "a", "caption"],
  ["Watch", "what", "happens", "next"],
  ["Keep", "going"],
] as const;

function groupDuration(wordCount: number): number {
  return Math.max(1, (wordCount - 1) * WORD_STAGGER_FRAMES + HOLD_FRAMES);
}

/**
 * Sample phrases batched with the same {@link groupCaptionWords} rules as
 * production, so `captionsAtATime` controls how many words appear per group.
 */
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

/** Active caption/quote/text group for the current preview frame. */
export function CaptionGroupPreview({
  groups,
  frame,
  variant,
}: {
  groups: CaptionGroupProp[];
  frame: number;
  variant: "dynamic" | "static";
}) {
  const active = groups.find(
    (group) => frame >= group.startFrame && frame < group.endFrame,
  );

  if (!active) return null;

  const view =
    variant === "static" ? (
      <StaticGroupView group={active} frame={frame} fps={PREVIEW_FPS} />
    ) : (
      <DynamicGroupView group={active} frame={frame} fps={PREVIEW_FPS} />
    );

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
      {view}
    </AbsoluteFill>
  );
}
