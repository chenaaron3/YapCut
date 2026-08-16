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

/** Edge resize grip on a selected edit range — fills the parent {@link WordGap}. */
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
      className="absolute top-1/2 left-0 z-10 flex h-[1.15em] w-full -translate-y-1/2 cursor-ew-resize items-stretch px-px"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onResizeEdge?.(edge, span.editId);
      }}
    >
      <span
        className={cn(
          "w-full rounded-sm bg-[#F5F9CE]",
          edge === "middle" && "bg-[#FFA102]",
        )}
      />
    </button>
  );
}
