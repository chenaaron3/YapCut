import type { PointerEvent as ReactPointerEvent } from "react";

import { TransformHandles } from "~/editor/components/player/TransformHandles";
import {
  boxCss,
  type BoxStyle,
} from "~/editor/components/player/transform-overlay";
import type { EditableTransform } from "~/editor/lib/use-editable-transform";

export type TransformDragKind = "move" | "scale" | "rotate";

/**
 * Selected transform chrome (b-roll, text/listicle, zoom) — same fill box +
 * move / scale / rotate handles for every layer.
 */
export function SelectedChrome({
  editable,
  box,
  onHitPointerDown,
  startDrag,
  onHoverChange,
}: {
  editable: EditableTransform;
  box: BoxStyle;
  onHitPointerDown: (
    e: ReactPointerEvent,
    editable: EditableTransform,
  ) => void;
  startDrag: (
    e: ReactPointerEvent,
    mode: TransformDragKind,
    editable: EditableTransform,
  ) => void;
  onHoverChange: (id: number | null) => void;
}) {
  return (
    <div
      data-edit-hit={editable.editId}
      className="border-primary/90 pointer-events-auto absolute cursor-move border shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
      style={boxCss(box)}
      onPointerDown={(e) => onHitPointerDown(e, editable)}
      onPointerEnter={() => onHoverChange(editable.editId)}
      onPointerLeave={() => onHoverChange(null)}
    >
      <TransformHandles
        scale={box.scale}
        onRotate={(e) => startDrag(e, "rotate", editable)}
        onScale={(e) => startDrag(e, "scale", editable)}
      />
    </div>
  );
}
