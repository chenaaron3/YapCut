"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { assetRunForAssetId, durationMapFromAssets } from "~/domain/aroll/arolls";
import { ArollMiniPlayer } from "~/editor/components/assets/ArollMiniPlayer";
import { useSelection } from "~/editor/selection-store";
import { useEditor } from "~/editor/store";
import { cn } from "~/lib/utils";

import type { EditorAsset } from "~/editor/store";
import type { HTMLAttributes } from "react";

export function ArollRowContent({
  asset,
  playing,
  onTogglePlay,
  onSelect,
  selected,
  dragHandleProps,
  dragging,
}: {
  asset: EditorAsset;
  playing: boolean;
  onTogglePlay: () => void;
  onSelect?: () => void;
  selected?: boolean;
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>;
  dragging?: boolean;
}) {
  return (
    <div
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
      className={cn(
        "bg-panel-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
        onSelect && "cursor-pointer",
        selected && "outline-primary/50 outline outline-2",
        dragging && "opacity-50 shadow-md",
      )}
    >
      <ArollMiniPlayer
        asset={asset}
        playing={playing}
        onToggle={onTogglePlay}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">
          {asset.originalFilename ?? asset.id.slice(0, 8)}
        </div>
        <div className="text-muted-foreground mt-0.5 text-xs">
          {asset.kind}
          {asset.durationSec != null
            ? ` · ${asset.durationSec.toFixed(1)}s`
            : null}
        </div>
      </div>
      <button
        type="button"
        className="text-muted-foreground flex shrink-0 cursor-grab touch-none items-center self-stretch px-0.5 active:cursor-grabbing"
        title="Drag to reorder"
        aria-label={`Reorder ${asset.originalFilename ?? "clip"}`}
        {...dragHandleProps}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

export function SortableArollRow({
  asset,
  playing,
  onTogglePlay,
}: {
  asset: EditorAsset;
  playing: boolean;
  onTogglePlay: () => void;
}) {
  const select = useSelection((s) => s.select);
  const selected = useSelection((s) =>
    s.selection?.kind === "arollAsset"
      ? s.selection.ids.includes(asset.id)
      : false,
  );
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: asset.id });

  const onSelect = () => {
    select("arollAsset", asset.id);
    const editor = useEditor.getState();
    if (!editor.config) return;
    const durations = durationMapFromAssets(editor.assets);
    const run = assetRunForAssetId(editor.config.arolls, durations, asset.id);
    if (!run) return;
    if (editor.timelineSec < run.start || editor.timelineSec >= run.end) {
      editor.seekTimeline(run.start);
    }
  };

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(isDragging && "z-10")}
    >
      <ArollRowContent
        asset={asset}
        playing={playing && !isDragging}
        onTogglePlay={onTogglePlay}
        onSelect={onSelect}
        selected={selected}
        dragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </li>
  );
}
