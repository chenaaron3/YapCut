import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CloudUpload } from "lucide-react";
import { createPortal } from "react-dom";

import {
  ClipCard,
  SortableClipCard,
} from "~/components/projects/create-project/ClipCard";
import { CREATE_LIMITS_HINT } from "~/domain/create-limits";
import { cn } from "~/lib/utils";

import type { DragEndEvent, DragStartEvent, Modifier } from "@dnd-kit/core";
import type { ClipItem } from "~/components/projects/create-project/types";
import type { DropzoneInputProps } from "react-dropzone";

const restrictToVerticalAxis: Modifier = ({ transform }) => ({
  ...transform,
  x: 0,
});

export function ClipStack({
  clips,
  activeId,
  draggingClip,
  busy,
  checking,
  isDragAccept,
  limitError,
  getInputProps,
  openFilePicker,
  onSelect,
  onRemove,
  onMove,
  onDragStart,
  onDragEnd,
  onDragCancel,
}: {
  clips: ClipItem[];
  activeId: string | null;
  draggingClip: ClipItem | null;
  busy: boolean;
  checking: boolean;
  isDragAccept: boolean;
  limitError: string | null;
  getInputProps: () => DropzoneInputProps;
  openFilePicker: () => void;
  onSelect: (id: string, index: number) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: () => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  return (
    <>
      <input {...getInputProps()} />
      <button
        type="button"
        disabled={busy || checking}
        className={cn(
          "mt-5 flex min-h-14 w-[calc(100%-0.5rem)] cursor-pointer items-center gap-2 rounded-2xl border-[1.5px] border-dashed border-[#450E16] bg-[#F5F9CE]/55 px-3.5 py-2.5 text-left text-[17px] leading-none text-[#432E6F] disabled:pointer-events-none disabled:opacity-50",
          isDragAccept && "border-[#FFA102] bg-[#FFA102]/15",
        )}
        onClick={openFilePicker}
      >
        <CloudUpload className="size-5 shrink-0 text-[#FFA102]" aria-hidden />
        <span>
          <strong className="font-bold text-[#450E16]">
            {checking ? "Checking videos…" : "+ Add more videos"}
          </strong>{" "}
          {checking ? "" : "or drop them here"}
        </span>
      </button>
      <p className="mt-2 text-sm leading-snug text-[#432E6F]">
        {CREATE_LIMITS_HINT}
      </p>
      {limitError ? (
        <p className="text-destructive mt-2 text-sm" role="alert">
          {limitError}
        </p>
      ) : null}

      <div
        className="mt-4 min-h-0 min-w-0 flex-1 overflow-x-clip overflow-y-auto overscroll-contain py-1 pr-2"
        onKeyDown={(event) => {
          if (!event.altKey || busy) return;
          if (!(event.target instanceof HTMLElement)) return;
          const id = event.target
            .closest("[data-clip-id]")
            ?.getAttribute("data-clip-id");
          if (!id) return;
          if (event.key === "ArrowUp") {
            event.preventDefault();
            onMove(id, -1);
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            onMove(id, 1);
          }
        }}
      >
        {clips.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            autoScroll={false}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={onDragCancel}
          >
            <SortableContext
              items={clips.map((clip) => clip.id)}
              strategy={verticalListSortingStrategy}
            >
              <ol
                role="listbox"
                aria-label="Video sequence"
                className="flex w-full min-w-0 list-none flex-col gap-3 p-0"
              >
                {clips.map((clip, index) => (
                  <SortableClipCard
                    key={clip.id}
                    clip={clip}
                    index={index}
                    selected={clip.id === activeId}
                    busy={busy}
                    onSelect={() => onSelect(clip.id, index)}
                    onRemove={() => onRemove(clip.id)}
                  />
                ))}
              </ol>
            </SortableContext>
            {createPortal(
              <DragOverlay dropAnimation={null}>
                {draggingClip ? (
                  <ClipCard
                    clip={draggingClip}
                    index={Math.max(
                      0,
                      clips.findIndex((clip) => clip.id === draggingClip.id),
                    )}
                    selected={draggingClip.id === activeId}
                    busy={busy}
                    onSelect={() => undefined}
                    onRemove={() => undefined}
                  />
                ) : null}
              </DragOverlay>,
              document.body,
            )}
          </DndContext>
        ) : null}
      </div>
    </>
  );
}
