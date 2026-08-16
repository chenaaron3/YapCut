import { isListicleEdit } from "~/domain/listicle";
import type {
  Edit,
  TemplateStyle,
  VfxQuoteEdit,
} from "~/domain/project-config";
import type { TimelineTime } from "~/domain/time";
import { DEFAULT_QUOTE_TEMPLATE_ID } from "~/remotion/templates/quote";

const EPS = 0.001;

export function isQuoteEdit(edit: Edit): edit is VfxQuoteEdit {
  return edit.kind === "vfx" && edit.type === "quote";
}

/** Place-time defaults for a quote VFX (range filled by `placeEdit`). */
export function quoteSeed(): {
  kind: "vfx";
  type: "quote";
  style: TemplateStyle;
} {
  return {
    kind: "vfx",
    type: "quote",
    style: { templateId: DEFAULT_QUOTE_TEMPLATE_ID },
  };
}

function rangesOverlap(a: TimelineTime, b: TimelineTime): boolean {
  return a.start < b.end - EPS && b.start < a.end - EPS;
}

export type QuoteRangeConflict = "quote" | "listicle";

/**
 * Why `range` cannot host a quote: another quote, or a listicle
 * (quotes must not stack on listicles).
 */
export function quoteRangeConflict(
  edits: readonly Edit[],
  range: TimelineTime,
  excludeId?: number,
): QuoteRangeConflict | null {
  for (const e of edits) {
    if (isListicleEdit(e) && rangesOverlap(e, range)) return "listicle";
    if (isQuoteEdit(e) && e.id !== excludeId && rangesOverlap(e, range)) {
      return "quote";
    }
  }
  return null;
}

/** True if `range` conflicts with another quote or any listicle. */
export function quoteRangeConflicts(
  edits: readonly Edit[],
  range: TimelineTime,
  excludeId?: number,
): boolean {
  return quoteRangeConflict(edits, range, excludeId) != null;
}
