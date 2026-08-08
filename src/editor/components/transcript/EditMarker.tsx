import { chromeByKey } from "~/editor/lib/edit-chrome";
import type { WordEditSpan } from "~/editor/lib/word-annotations";
import { cn } from "~/lib/utils";

type Props = {
  span: WordEditSpan;
  selected: boolean;
  onSelect: (editId: number, toggle: boolean) => void;
  /** Same as start-edge resize — drag moves the edit start. */
  onDragStart?: (editId: number, e: React.MouseEvent) => void;
};

/** Transcript marker chip — inline before the word, chrome from registry. */
export function EditMarker({
  span,
  selected,
  onSelect,
  onDragStart,
}: Props) {
  const chrome = chromeByKey(span.chromeKey);
  const { Icon } = chrome;

  return (
    <button
      type="button"
      title={`${chrome.label} — drag to move start`}
      aria-label={chrome.label}
      className={cn(
        "relative mr-0.5 inline-flex size-[1.1em] shrink-0 cursor-ew-resize items-center justify-center rounded-sm align-middle select-none",
        selected ? chrome.markerSelectedClass : chrome.markerClass,
      )}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDragStart?.(span.editId, e);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(span.editId, e.metaKey || e.ctrlKey);
      }}
    >
      <Icon className="size-[0.65em]" strokeWidth={2.5} />
    </button>
  );
}
