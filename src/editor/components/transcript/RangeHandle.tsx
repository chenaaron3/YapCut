import {
  isEndHandleRole,
  isSplitHandleRole,
  isStartHandleRole,
  type WordEditSpan,
} from "~/editor/lib/word-annotations";
import { cn } from "~/lib/utils";

export type ResizeEdge = "start" | "middle" | "end";

type Props = {
  edge: ResizeEdge;
  /** Primary span for this word; null / unselected ⇒ no handle. */
  span: WordEditSpan | null;
  selected: boolean;
  onResizeEdge?: (edge: ResizeEdge, editId: number) => void;
};

/** Edge resize grip on a selected edit range. */
export function RangeHandle({ edge, span, selected, onResizeEdge }: Props) {
  if (!span || !selected) return null;
  if (edge === "start" && !isStartHandleRole(span.role)) return null;
  if (edge === "end" && !isEndHandleRole(span.role)) return null;
  if (edge === "middle" && !isSplitHandleRole(span.role)) return null;

  const label =
    edge === "start"
      ? "Resize start"
      : edge === "end"
        ? "Resize end"
        : "Move split";

  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "absolute top-1/2 z-10 h-3 w-1.5 -translate-y-1/2 cursor-ew-resize rounded-sm bg-white",
        edge === "start" && "-left-1",
        edge === "end" && "-right-1",
        // Split sits on the word end (same as an end handle), not mid-glyph.
        edge === "middle" && "-right-1 bg-amber-200",
      )}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onResizeEdge?.(edge, span.editId);
      }}
    />
  );
}
