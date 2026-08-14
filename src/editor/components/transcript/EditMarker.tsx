import { useRef } from "react";

import { BrollThumb } from "~/editor/components/assets/BrollThumb";
import { chromeByKey } from "~/editor/lib/edit-chrome";
import type { WordEditSpan } from "~/editor/lib/word-annotations";
import { useEditor } from "~/editor/store";
import { cn } from "~/lib/utils";

const DRAG_THRESHOLD_PX = 3;

type Props = {
  span: WordEditSpan;
  selected: boolean;
  onSelect: (editId: number, toggle: boolean) => void;
  /** Same as start-edge resize — drag moves the edit start. */
  onDragStart?: (editId: number, e: React.MouseEvent) => void;
  className?: string;
};

export function markerLabel(span: WordEditSpan): string {
  return chromeByKey(span.chromeKey).label;
}

/** Transcript marker chip — inline before the word, chrome from registry. */
export function EditMarker({
  span,
  selected,
  onSelect,
  onDragStart,
  className,
}: Props) {
  const chrome = chromeByKey(span.chromeKey);
  const { Icon } = chrome;
  const assets = useEditor((s) => s.assets);
  const brollAssetId = useEditor((s) => {
    const edit = s.config?.edits.find((e) => e.id === span.editId);
    return edit?.kind === "broll" ? edit.assetId : null;
  });
  const movedRef = useRef(false);

  const brollAsset =
    span.chromeKey === "broll" && brollAssetId != null
      ? (assets.find((a) => a.id === brollAssetId) ?? null)
      : null;

  const movable = onDragStart != null;
  const label = markerLabel(span);

  return (
    <button
      type="button"
      title={movable ? `${label} — drag to move` : label}
      aria-label={label}
      className={cn(
        "relative inline-flex size-[1.1em] shrink-0 items-center justify-center overflow-hidden rounded-sm align-middle select-none",
        movable ? "cursor-ew-resize" : "cursor-pointer",
        brollAsset
          ? selected
            ? "ring-2 ring-broll ring-offset-1 ring-offset-background"
            : "ring-1 ring-broll/60"
          : selected
            ? chrome.markerSelectedClass
            : chrome.markerClass,
        className,
      )}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        movedRef.current = false;
        const startX = e.clientX;
        const onMove = (ev: MouseEvent) => {
          if (Math.abs(ev.clientX - startX) > DRAG_THRESHOLD_PX) {
            movedRef.current = true;
          }
        };
        const onUp = () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        if (movable) onDragStart?.(span.editId, e);
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (movedRef.current) return;
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
