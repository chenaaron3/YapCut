import { isListicleEdit } from "~/domain/listicle";
import type { Edit, EditId } from "~/domain/project-config";
import type { GlobalTranscriptWord } from "~/domain/transcript";
import {
  chromeForEdit,
  chromeRank,
  type EditChromeKey,
} from "~/editor/lib/edit-chrome";
import { isSelected, type Selection } from "~/editor/lib/selection";

/**
 * `split` = listicle indicator→value boundary (middle handle).
 * `split-start` / `split-end` = split coincides with start/end word.
 */
export type RangeRole =
  | "start"
  | "middle"
  | "split"
  | "split-start"
  | "split-end"
  | "end"
  | "both"
  | "point";

/** One Edit covering (or pinned to) a transcript word. */
export type WordEditSpan = {
  editId: EditId;
  chromeKey: EditChromeKey;
  role: RangeRole;
};

export type WordAnnotation = {
  spans: WordEditSpan[];
};

export const EMPTY_WORD_ANNOTATION: WordAnnotation = { spans: [] };

function wordOverlaps(
  word: GlobalTranscriptWord,
  start: number,
  end: number,
): boolean {
  return word.start < end - 0.001 && word.end > start + 0.001;
}

function roleForIndex(
  globalIndex: number,
  first: number,
  last: number,
): RangeRole {
  if (first === last) return "both";
  if (globalIndex === first) return "start";
  if (globalIndex === last) return "end";
  return "middle";
}

function pushSpan(
  map: Map<number, WordAnnotation>,
  globalIndex: number,
  span: WordEditSpan,
): void {
  const prev = map.get(globalIndex) ?? { spans: [] };
  map.set(globalIndex, { spans: [...prev.spans, span] });
}

/**
 * Map each edit onto the transcript words it covers for chrome
 * (markers, underlines, resize handles).
 */
export function buildWordAnnotations(
  words: readonly GlobalTranscriptWord[],
  edits: readonly Edit[],
): Map<number, WordAnnotation> {
  const map = new Map<number, WordAnnotation>();

  for (const edit of edits) {
    const chrome = chromeForEdit(edit);
    if (!chrome) continue;

    // Words whose timeline range overlaps this edit.
    const covered = words.filter((w) =>
      wordOverlaps(w, edit.start, edit.end),
    );

    // No overlap (e.g. title before speech) — pin a point marker on the nearest word.
    if (covered.length === 0) {
      if (words.length === 0) continue;
      const nearest =
        words.find((w) => w.start >= edit.start - 0.05) ?? words[0]!;
      pushSpan(map, nearest.globalIndex, {
        editId: edit.id,
        chromeKey: chrome.key,
        role: "point",
      });
      continue;
    }

    // Annotate start / middle / end (or both) on each covered word.
    const first = covered[0]!.globalIndex;
    const last = covered[covered.length - 1]!.globalIndex;

    let splitIndex: number | null = null;
    if (
      isListicleEdit(edit) &&
      edit.middle != null &&
      covered.length > 1
    ) {
      // Middle is an end-of-word boundary: pin the handle on the last
      // covered word that ends at/before the split (indicator side).
      const splitWord =
        [...covered]
          .filter((w) => w.end <= edit.middle! + 0.001)
          .at(-1) ??
        covered.find(
          (w) =>
            w.start < edit.middle! + 0.001 && w.end > edit.middle! - 0.001,
        ) ??
        covered[0]!;
      splitIndex = splitWord.globalIndex;
    }

    for (const w of covered) {
      let role = roleForIndex(w.globalIndex, first, last);
      if (splitIndex != null && w.globalIndex === splitIndex) {
        if (w.globalIndex === first) role = "split-start";
        else if (w.globalIndex === last) role = "split-end";
        else role = "split";
      }
      pushSpan(map, w.globalIndex, {
        editId: edit.id,
        chromeKey: chrome.key,
        role,
      });
    }
  }

  return map;
}

export function isMarkerRole(role: RangeRole): boolean {
  return (
    role === "start" ||
    role === "both" ||
    role === "point" ||
    role === "split-start"
  );
}

export function isStartHandleRole(role: RangeRole): boolean {
  return (
    role === "start" ||
    role === "both" ||
    role === "point" ||
    role === "split-start"
  );
}

export function isEndHandleRole(role: RangeRole): boolean {
  return (
    role === "end" ||
    role === "both" ||
    role === "point" ||
    role === "split-end"
  );
}

export function isSplitHandleRole(role: RangeRole): boolean {
  return (
    role === "split" || role === "split-start" || role === "split-end"
  );
}

/**
 * Single span driving underline / highlight / handles.
 * Selected edit wins; otherwise earlier entry in `EDIT_CHROME`.
 */
export function resolvePrimarySpan(
  spans: readonly WordEditSpan[],
  selection: Selection | null,
): WordEditSpan | null {
  if (spans.length === 0) return null;

  const selected = spans.filter((s) =>
    isSelected(selection, "edit", s.editId),
  );
  const pool = selected.length > 0 ? selected : spans;

  let best = pool[0]!;
  let bestRank = chromeRank(best.chromeKey);
  for (let i = 1; i < pool.length; i++) {
    const span = pool[i]!;
    const rank = chromeRank(span.chromeKey);
    if (rank < bestRank) {
      best = span;
      bestRank = rank;
    }
  }
  return best;
}
