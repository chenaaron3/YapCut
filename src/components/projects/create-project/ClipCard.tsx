import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Film, GripVertical, Trash2 } from "lucide-react";

import { formatClock } from "~/components/projects/create-project/format";
import { cn } from "~/lib/utils";

import type { ClipItem } from "~/components/projects/create-project/types";
import type { HTMLAttributes } from "react";

export function ClipCard({
  clip,
  index,
  selected,
  busy,
  onSelect,
  onRemove,
  dragHandleProps,
  dragging,
}: {
  clip: ClipItem;
  index: number;
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
  onRemove: () => void;
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>;
  dragging?: boolean;
}) {
  return (
    <div
      data-clip-id={clip.id}
      role="option"
      aria-selected={selected}
      tabIndex={busy ? -1 : 0}
      aria-label={`Clip ${index + 1}, ${clip.file.name}. Use Alt plus arrow keys to reorder.`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "relative grid w-full cursor-pointer grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border-[1.5px] border-[#450E16] bg-[#F5F9CE]/80 px-2 py-2 text-[#450E16] shadow-[4px_4px_0_rgb(69_14_22/0.18)] outline-none select-none motion-safe:hover:translate-x-px motion-safe:hover:translate-y-px motion-safe:hover:bg-[#FFA102]/20 motion-safe:hover:shadow-[2px_2px_0_rgb(69_14_22/0.18)]",
        selected &&
          "bg-[#FFA102] shadow-[inset_0_0_0_2px_rgb(255_249_180/0.46),4px_4px_0_#450E16] motion-safe:hover:bg-[#FFA102] motion-safe:hover:shadow-[2px_2px_0_#450E16]",
        dragging && "invisible",
        "focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#FFA102]",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "ember-mono grid size-8 place-items-center rounded-full border-[1.5px] border-[#450E16] text-xs font-bold",
          selected
            ? "bg-[#450E16] text-[#FFA102]"
            : "bg-[#F5F9CE] text-[#450E16]",
        )}
      >
        {index + 1}
      </span>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <Film className="size-4 shrink-0" aria-hidden />
          <span className="ember-display truncate text-[17px] leading-none font-bold tracking-tight">
            {clip.file.name}
          </span>
        </div>
        <div
          className={cn(
            "ember-mono mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold tracking-[0.04em] uppercase",
            selected ? "text-[#450E16]" : "text-[#432E6F]",
          )}
        >
          <span>{formatClock(clip.durationSec)}</span>
          <span aria-hidden>·</span>
          <span>{clip.format}</span>
          <span aria-hidden>·</span>
          <span>A-roll</span>
        </div>
      </div>
      <div className="flex items-center">
        <button
          type="button"
          className={cn(
            "grid size-8 cursor-grab place-items-center rounded-[10px] active:cursor-grabbing",
            selected ? "text-[#450E16]" : "text-[#432E6F]",
          )}
          title="Drag to reorder"
          aria-label={`Drag to reorder ${clip.file.name}`}
          disabled={busy}
          {...dragHandleProps}
          onClick={(event) => event.stopPropagation()}
        >
          <GripVertical className="size-5" aria-hidden />
        </button>
        <button
          type="button"
          className="grid size-8 place-items-center rounded-[10px] text-[#BC2D29]"
          title="Remove clip"
          aria-label={`Remove ${clip.file.name}`}
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function SortableClipCard({
  clip,
  index,
  selected,
  busy,
  onSelect,
  onRemove,
}: {
  clip: ClipItem;
  index: number;
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: clip.id, disabled: busy });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: isDragging
          ? undefined
          : CSS.Transform.toString(transform ? { ...transform, x: 0 } : null),
        transition: isDragging ? undefined : transition,
      }}
      className={cn("w-full min-w-0", isDragging && "z-10")}
    >
      <ClipCard
        clip={clip}
        index={index}
        selected={selected}
        busy={busy}
        onSelect={onSelect}
        onRemove={onRemove}
        dragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </li>
  );
}
