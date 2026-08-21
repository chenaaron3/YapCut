import { useEffect, useRef, useState } from "react";

import {
  clampTransformScale,
  snapTransformOffset,
  snapTransformScale,
  transformOf,
} from "~/domain/edit/transform";
import { HitTarget } from "~/editor/components/player/HitTarget";
import { SelectedChrome } from "~/editor/components/player/SelectedChrome";
import { SnapGuides } from "~/editor/components/player/SnapGuides";
import {
  boxStyle,
  editIdsFromPoint,
  pointerInEditSpace,
} from "~/editor/components/player/transform-overlay";
import { useEditableTransforms } from "~/editor/lib/player/use-editable-transform";
import { runGesture } from "~/editor/lib/selection/gesture";
import { primaryId } from "~/editor/lib/selection/selection";
import { useSelection } from "~/editor/selection-store";
import { useEditor } from "~/editor/store";
import {
  COMPOSITION_HEIGHT,
  COMPOSITION_WIDTH,
} from "~/remotion/helpers/constants";
import {
  zoomLayerCssPct,
  zoomTransformAtFrame,
} from "~/remotion/helpers/zoom-transform";

import type { SnapGuide, Transform } from "~/domain/edit/transform";
import type { EditableTransform } from "~/editor/lib/player/use-editable-transform";
import type { ReactNode, PointerEvent as ReactPointerEvent } from "react";

type DragMode =
  | { kind: "move"; startX: number; startY: number; origin: Transform }
  | { kind: "scale"; startDist: number; origin: Transform }
  | { kind: "rotate"; startAngle: number; origin: Transform };

type DragVisual = {
  transform: Transform;
  guides: SnapGuide[];
};

/**
 * HTML overlay on the Remotion player for select + drag move / scale / rotate.
 * Click selects without seeking; empty preview keeps click-to-play.
 */
export function TransformOverlay({
  onDraggingChange,
}: {
  onDraggingChange?: (dragging: boolean) => void;
}) {
  const editables = useEditableTransforms();
  const selectedId = useSelection((s) => {
    if (s.selection?.kind !== "edit") return null;
    return primaryId(s.selection);
  });
  const setSelection = useSelection((s) => s.setSelection);
  const patchEdit = useEditor((s) => s.patchEdit);
  const frame = useEditor((s) => s.frame);
  const zooms = useEditor((s) => s.props?.zooms ?? []);
  const zoomPose = zoomTransformAtFrame(frame, zooms);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragMode | null>(null);
  const dragInZoomRef = useRef(false);
  const zoomPoseRef = useRef(zoomPose);
  zoomPoseRef.current = zoomPose;
  const endGestureRef = useRef<(() => void) | null>(null);
  const editIdRef = useRef<number | null>(null);
  const boxRef = useRef<{ w: number; h: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [visual, setVisual] = useState<DragVisual | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const selected =
    selectedId == null
      ? null
      : (editables.find((e) => e.editId === selectedId) ?? null);

  const selectedBox = selected
    ? boxStyle(selected, visual?.transform ?? selected.transform)
    : null;
  boxRef.current = selectedBox?.base ?? null;
  editIdRef.current = selected?.editId ?? null;

  useEffect(() => {
    onDraggingChange?.(dragging);
  }, [dragging, onDraggingChange]);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      const root = rootRef.current;
      const box = boxRef.current;
      const id = editIdRef.current;
      if (!drag || !root || !box || id == null) return;
      const rect = root.getBoundingClientRect();
      const { x, y } = pointerInEditSpace(
        e.clientX,
        e.clientY,
        rect,
        dragInZoomRef.current,
        zoomPoseRef.current,
      );
      const cx =
        COMPOSITION_WIDTH / 2 + drag.origin.offsetX * COMPOSITION_WIDTH;
      const cy =
        COMPOSITION_HEIGHT / 2 + drag.origin.offsetY * COMPOSITION_HEIGHT;

      if (drag.kind === "move") {
        const dx = (x - drag.startX) / COMPOSITION_WIDTH;
        const dy = (y - drag.startY) / COMPOSITION_HEIGHT;
        const snapped = snapTransformOffset({
          offsetX: drag.origin.offsetX + dx,
          offsetY: drag.origin.offsetY + dy,
          boxW: box.w,
          boxH: box.h,
          scale: drag.origin.scale,
          compW: COMPOSITION_WIDTH,
          compH: COMPOSITION_HEIGHT,
        });
        const next: Transform = {
          ...drag.origin,
          offsetX: snapped.offsetX,
          offsetY: snapped.offsetY,
        };
        setVisual({ transform: next, guides: snapped.guides });
        patchEdit(
          id,
          { offsetX: snapped.offsetX, offsetY: snapped.offsetY },
          true,
        );
        return;
      }

      if (drag.kind === "scale") {
        const dist = Math.hypot(x - cx, y - cy);
        if (drag.startDist < 1) return;
        let scale = clampTransformScale(
          drag.origin.scale * (dist / drag.startDist),
        );
        scale = clampTransformScale(
          snapTransformScale({
            scale,
            boxW: box.w,
            boxH: box.h,
            compW: COMPOSITION_WIDTH,
            compH: COMPOSITION_HEIGHT,
          }),
        );
        const next: Transform = { ...drag.origin, scale };
        setVisual({ transform: next, guides: [] });
        patchEdit(id, { scale }, true);
        return;
      }

      const angle = (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
      let delta = angle - drag.startAngle;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      let rotation = drag.origin.rotation + delta;
      const rotSnap = 45;
      const nearest = Math.round(rotation / rotSnap) * rotSnap;
      if (Math.abs(rotation - nearest) <= 8) rotation = nearest;
      const next: Transform = { ...drag.origin, rotation };
      setVisual({ transform: next, guides: [] });
      patchEdit(id, { rotation }, true);
    };

    const onUp = () => {
      dragRef.current = null;
      setVisual(null);
      setDragging(false);
      endGestureRef.current?.();
      endGestureRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging, patchEdit]);

  const startDrag = (
    e: ReactPointerEvent,
    mode: DragMode["kind"],
    editable: EditableTransform,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const { x, y } = pointerInEditSpace(
      e.clientX,
      e.clientY,
      rect,
      editable.inZoom,
      zoomPoseRef.current,
    );
    const origin = transformOf(editable.transform);
    const cx = COMPOSITION_WIDTH / 2 + origin.offsetX * COMPOSITION_WIDTH;
    const cy = COMPOSITION_HEIGHT / 2 + origin.offsetY * COMPOSITION_HEIGHT;
    endGestureRef.current?.();
    endGestureRef.current = runGesture();
    dragInZoomRef.current = editable.inZoom;
    setVisual({ transform: origin, guides: [] });

    if (mode === "move") {
      dragRef.current = { kind: "move", startX: x, startY: y, origin };
    } else if (mode === "scale") {
      dragRef.current = {
        kind: "scale",
        startDist: Math.max(1, Math.hypot(x - cx, y - cy)),
        origin,
      };
    } else {
      dragRef.current = {
        kind: "rotate",
        startAngle: (Math.atan2(y - cy, x - cx) * 180) / Math.PI,
        origin,
      };
    }
    setDragging(true);
  };

  const onHitPointerDown = (
    e: ReactPointerEvent,
    editable: EditableTransform,
  ) => {
    if (e.button !== 0) return;
    const hits = editIdsFromPoint(e.clientX, e.clientY);
    const keepSelected =
      selectedId != null && hits.includes(selectedId) ? selectedId : null;
    const targetId = keepSelected ?? hits[0] ?? editable.editId;

    if (targetId !== selectedId) {
      e.preventDefault();
      e.stopPropagation();
      // setSelection — not select() — so we never seek to edit start.
      setSelection({ kind: "edit", ids: [targetId] });
      return;
    }

    const target =
      editables.find((item) => item.editId === targetId) ?? editable;
    startDrag(e, "move", target);
  };

  if (editables.length === 0) return null;

  const guides = visual?.guides ?? [];
  const inZoom = editables.filter((item) => item.inZoom);
  const screen = editables.filter((item) => !item.inZoom);
  const draggingInZoom = selected?.inZoom === true;

  const paint = (editable: EditableTransform) => {
    const isSelected = editable.editId === selectedId;
    const t =
      isSelected && visual?.transform ? visual.transform : editable.transform;
    const box = boxStyle(editable, t);
    if (!isSelected) {
      return (
        <HitTarget
          key={editable.editId}
          editable={editable}
          box={box}
          showOutline={hoveredId === editable.editId}
          onPointerDown={onHitPointerDown}
          onHoverChange={setHoveredId}
        />
      );
    }
    return (
      <SelectedChrome
        key={editable.editId}
        editable={editable}
        box={box}
        onHitPointerDown={onHitPointerDown}
        startDrag={startDrag}
        onHoverChange={setHoveredId}
        dragging={dragging}
      />
    );
  };

  const zoomLayer = (children: ReactNode) => (
    <div
      className="pointer-events-none absolute inset-0"
      style={zoomLayerCssPct(zoomPose)}
    >
      {children}
    </div>
  );

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 z-50 overflow-hidden"
    >
      {inZoom.length > 0
        ? zoomLayer(
            <>
              {inZoom.map(paint)}
              {draggingInZoom ? <SnapGuides guides={guides} /> : null}
            </>,
          )
        : null}

      {screen.map(paint)}
      {!draggingInZoom ? <SnapGuides guides={guides} /> : null}
    </div>
  );
}
