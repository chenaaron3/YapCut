import type {
  Edit,
  VfxListicleEdit,
} from "~/domain/project-config";
import type { TimelineTime } from "~/domain/time";
import type { GlobalTranscriptWord } from "~/domain/transcript";

const MIN_PHASE_SEC = 0.05;

/** Place-time body for a listicle (id + start/end filled by `placeEdit`). */
export type ListicleSeed = Omit<VfxListicleEdit, "id" | "start" | "end">;

export function isListicleEdit(edit: Edit): edit is VfxListicleEdit {
  return edit.kind === "vfx" && edit.type === "listicle";
}

/** Clamp middle so both phases keep a minimum duration. */
export function clampListicleMiddle(
  start: number,
  middle: number,
  end: number,
  minLen = MIN_PHASE_SEC,
): number {
  const lo = start + minLen;
  const hi = end - minLen;
  if (hi <= lo) return (start + end) / 2;
  return Math.min(hi, Math.max(lo, middle));
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
 * Manual place: first covered word → indicator, rest → value.
 * `middle` = end of the last indicator word (end-handle snap semantics).
 */
export function listicleSeedFromWords(
  words: readonly GlobalTranscriptWord[],
  range: TimelineTime,
): ListicleSeed {
  const covered = wordsInRange(words, range);
  const first = covered[0];
  const rest = covered.slice(1);

  const indicatorText = first?.text.trim() ?? "";
  const valueRaw = rest.map((w) => w.text).join(" ").trim();
  const valueText = valueRaw ? toSimpleTitleCase(valueRaw) : "";

  const middle =
    first != null ? first.end : (range.start + range.end) / 2;

  return {
    kind: "vfx",
    type: "listicle",
    middle: clampListicleMiddle(range.start, middle, range.end),
    indicatorText,
    valueText,
    hideCaptions: true,
  };
}
