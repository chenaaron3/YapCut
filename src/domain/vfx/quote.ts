import { quoteTemplateStyle } from "~/domain/project/project-config";

import type { Edit, VfxQuoteEdit } from "~/domain/project/project-config";
import type { TimelineTime } from "~/domain/media/time";

const EPS = 0.001;

export function isQuoteEdit(edit: Edit): edit is VfxQuoteEdit {
  return edit.kind === "vfx" && edit.type === "quote";
}

/** Place-time defaults for a quote VFX (range filled by `placeEdit`). */
export function quoteSeed(): {
  kind: "vfx";
  type: "quote";
  style: VfxQuoteEdit["style"];
} {
  return {
    kind: "vfx",
    type: "quote",
    style: quoteTemplateStyle(),
  };
}

function rangesOverlap(a: TimelineTime, b: TimelineTime): boolean {
  return a.start < b.end - EPS && b.start < a.end - EPS;
}

/** True if `range` overlaps another quote. */
export function quoteRangeConflicts(
  edits: readonly Edit[],
  range: TimelineTime,
  excludeId?: number,
): boolean {
  return edits.some(
    (e) => isQuoteEdit(e) && e.id !== excludeId && rangesOverlap(e, range),
  );
}
