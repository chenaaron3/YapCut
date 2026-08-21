"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useRef, useState } from "react";

import {
  assetRunAtTimelineSec,
  assetRunTimelineRanges,
  buildArollLayout,
  durationMapFromAssets,
} from "~/domain/aroll/arolls";
import {
  ArollRowContent,
  SortableArollRow,
} from "~/editor/components/assets/ArollRow";
import { runGesture } from "~/editor/lib/selection/gesture";
import { useEditor } from "~/editor/store";

import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import type { EditorAsset } from "~/editor/store";

export function ArollAssetList({ assets }: { assets: EditorAsset[] }) {
  const reorderArollAssets = useEditor((s) => s.reorderArollAssets);
  const undo = useEditor((s) => s.undo);
  const playheadAssetId = useEditor((s) => {
    if (!s.config) return null;
    const runs = assetRunTimelineRanges(
      buildArollLayout(s.config.arolls, durationMapFromAssets(s.assets)),
    );
    return assetRunAtTimelineSec(runs, s.timelineSec)?.assetId ?? null;
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const endGestureRef = useRef<(() => void) | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const activeAsset =
    activeId == null ? null : (assets.find((a) => a.id === activeId) ?? null);

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    setPlayingId(null);
    endGestureRef.current = null;
  };

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = assets.findIndex((a) => a.id === active.id);
    const toIndex = assets.findIndex((a) => a.id === over.id);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    if (!endGestureRef.current) {
      endGestureRef.current = runGesture();
    }
    reorderArollAssets(fromIndex, toIndex, true);
  };

  const onDragEnd = (_event: DragEndEvent) => {
    setActiveId(null);
    endGestureRef.current?.();
    endGestureRef.current = null;
  };

  const onDragCancel = () => {
    setActiveId(null);
    if (endGestureRef.current) {
      // Undo restores pre-drag snapshot and clears gesture depth.
      undo();
      endGestureRef.current = null;
    }
  };

  if (assets.length === 0) {
    return (
      <div className="p-2">
        <p className="text-muted-foreground px-1 text-xs">No A-roll</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
      autoScroll={{
        threshold: { x: 0.15, y: 0.15 },
        acceleration: 12,
        interval: 5,
      }}
    >
      <SortableContext
        items={assets.map((a) => a.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="flex flex-col gap-1 p-2">
          {assets.map((asset) => (
            <SortableArollRow
              key={asset.id}
              asset={asset}
              playing={playingId === asset.id}
              atPlayhead={playheadAssetId === asset.id}
              onTogglePlay={() =>
                setPlayingId((id) => (id === asset.id ? null : asset.id))
              }
            />
          ))}
        </ul>
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {activeAsset ? (
          <ArollRowContent
            asset={activeAsset}
            playing={false}
            onTogglePlay={() => undefined}
            selected
            dragging
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
