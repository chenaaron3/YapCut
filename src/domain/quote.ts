import {
  normalizeQuoteEmphasisStyle,
  type QuoteEmphasisStyle,
} from "~/domain/emphasis-style";
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

/** `null` clears quote emphasis override (`emphasisStyle` omitted). */
export function withQuoteEmphasisStyle(
  edit: VfxQuoteEdit,
  emphasisStyle: QuoteEmphasisStyle | null,
): VfxQuoteEdit {
  if (emphasisStyle == null) {
    const rest = { ...edit };
    delete rest.emphasisStyle;
    return rest;
  }
  const normalized = normalizeQuoteEmphasisStyle(emphasisStyle);
  if (Object.keys(normalized).length === 0) {
    const rest = { ...edit };
    delete rest.emphasisStyle;
    return rest;
  }
  return { ...edit, emphasisStyle: normalized };
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

/**
 * True if `range` conflicts with another quote (optionally excluding one id)
 * or any listicle (quotes must not stack on listicles).
 */
export function quoteRangeConflicts(
  edits: readonly Edit[],
  range: TimelineTime,
  excludeId?: number,
): boolean {
  return edits.some((e) => {
    if (isListicleEdit(e) && rangesOverlap(e, range)) return true;
    return (
      isQuoteEdit(e) && e.id !== excludeId && rangesOverlap(e, range)
    );
  });
}
