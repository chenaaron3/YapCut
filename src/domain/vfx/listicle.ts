import {
  clampOverlayMiddle,
  type Edit,
  type TemplateStyle,
  type VfxListicleEdit,
} from "~/domain/project/project-config";
import type { TimelineTime } from "~/domain/media/time";
import { OVERLAY_TRANSFORM_DEFAULTS } from "~/domain/edit/transform";
import type { GlobalTranscriptWord } from "~/domain/transcript/transcript";

/** Place-time body for a listicle (id + start/end filled by `placeEdit`). */
export type ListicleSeed = Omit<VfxListicleEdit, "id" | "start" | "end">;

export function isListicleEdit(edit: Edit): edit is VfxListicleEdit {
  return edit.kind === "vfx" && edit.type === "listicle";
}

/** Simple title case for manual place (LLM handles small-word rules itself). */
function toSimpleTitleCase(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function wordsInRange(
  words: readonly GlobalTranscriptWord[],
  range: TimelineTime,
): GlobalTranscriptWord[] {
  return words.filter(
    (w) => w.start < range.end - 0.001 && w.end > range.start + 0.001,
  );
}

/**
 * Manual place: first covered word → heading, rest → subheading.
 * `middle` = end of the last heading word (end-handle snap semantics).
 * `style` copies Project.listicleStyle at place time.
 */
export function listicleSeedFromWords(
  words: readonly GlobalTranscriptWord[],
  range: TimelineTime,
  listicleStyle: TemplateStyle,
): ListicleSeed {
  const covered = wordsInRange(words, range);
  const first = covered[0];
  const rest = covered.slice(1);

  const heading = first?.text.trim() ?? "";
  const restText = rest.map((w) => w.text).join(" ").trim();
  const subheading = restText ? toSimpleTitleCase(restText) : "";

  const middle =
    first != null ? first.end : (range.start + range.end) / 2;

  return {
    kind: "vfx",
    type: "listicle",
    middle: clampOverlayMiddle(range.start, middle, range.end),
    heading,
    subheading,
    hideCaptions: true,
    style: listicleStyle,
    ...OVERLAY_TRANSFORM_DEFAULTS,
  };
}
