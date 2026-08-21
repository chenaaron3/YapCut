import type { ArollSection } from "~/remotion/helpers/types";

export type ArollLayer = "original" | "occlude";

/** Which A-roll plate is current: original picture vs Separate-background person. */
export function arollLayerAtFrame(
  sections: readonly ArollSection[],
  frame: number,
): ArollLayer {
  let t = 0;
  for (const section of sections) {
    if (frame >= t && frame < t + section.durationInFrames) {
      return section.mask?.type === "occlude" ? "occlude" : "original";
    }
    t += section.durationInFrames;
  }
  return sections.at(-1)?.mask?.type === "occlude" ? "occlude" : "original";
}
