import { BrollThumb } from "~/editor/components/assets/BrollThumb";
import { chromeByKey } from "~/editor/lib/edit-chrome";
import type { WordEditSpan } from "~/editor/lib/word-annotations";
import { useEditor } from "~/editor/store";
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
  const assets = useEditor((s) => s.assets);
  const edit = useEditor((s) =>
    s.config?.edits.find((e) => e.id === span.editId),
  );

  const brollAsset =
    span.chromeKey === "broll" && edit?.kind === "broll"
      ? (assets.find((a) => a.id === edit.assetId) ?? null)
      : null;

  const label = brollAsset
    ? (brollAsset.originalFilename?.split("/").pop() ?? chrome.label)
    : chrome.label;

  return (
    <button
      type="button"
      title={`${label} — drag to move start`}
      aria-label={label}
      className={cn(
        "relative mr-0.5 inline-flex size-[1.1em] shrink-0 cursor-ew-resize items-center justify-center overflow-hidden rounded-sm align-middle select-none",
        brollAsset
          ? selected
            ? "ring-2 ring-broll ring-offset-1 ring-offset-background"
            : "ring-1 ring-broll/60"
          : selected
            ? chrome.markerSelectedClass
            : chrome.markerClass,
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
      {brollAsset ? (
        <BrollThumb asset={brollAsset} className="size-full" />
      ) : (
        <Icon className="size-[0.65em]" strokeWidth={2.5} />
      )}
    </button>
  );
}
