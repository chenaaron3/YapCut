import {
  isEndHandleRole,
  isStartHandleRole,
  type WordEditSpan,
} from "~/editor/lib/word-annotations";
import { cn } from "~/lib/utils";

type Props = {
  edge: "start" | "end";
  /** Primary span for this word; null / unselected ⇒ no handle. */
  span: WordEditSpan | null;
  selected: boolean;
  onResizeEdge?: (edge: "start" | "end", editId: number) => void;
};

/** Edge resize grip on a selected edit range. */
export function RangeHandle({ edge, span, selected, onResizeEdge }: Props) {
  if (!span || !selected) return null;
  if (edge === "start" && !isStartHandleRole(span.role)) return null;
  if (edge === "end" && !isEndHandleRole(span.role)) return null;

  return (
    <button
      type="button"
      aria-label={edge === "start" ? "Resize start" : "Resize end"}
      className={cn(
        "absolute top-1/2 z-10 h-3 w-1.5 -translate-y-1/2 cursor-ew-resize rounded-sm bg-white",
        edge === "start" ? "-left-1" : "-right-1",
      )}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onResizeEdge?.(edge, span.editId);
      }}
    />
  );
}
