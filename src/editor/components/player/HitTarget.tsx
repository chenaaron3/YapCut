import type { PointerEvent as ReactPointerEvent } from "react";

import {
  boxCss,
  type BoxStyle,
} from "~/editor/components/player/transform-overlay";
import type { EditableTransform } from "~/editor/lib/use-editable-transform";

/** Invisible hit (hover outline) for an unselected transformable at the playhead. */
export function HitTarget({
  editable,
  box,
  showOutline,
  onPointerDown,
  onHoverChange,
}: {
  editable: EditableTransform;
  box: BoxStyle;
  showOutline: boolean;
  onPointerDown: (
    e: ReactPointerEvent,
    editable: EditableTransform,
  ) => void;
  onHoverChange: (id: number | null) => void;
}) {
  return (
    <div
      data-edit-hit={editable.editId}
      className={`pointer-events-auto absolute cursor-pointer ${
        showOutline
          ? "border border-primary/50 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
          : "border border-transparent"
      }`}
      style={boxCss(box)}
      onPointerDown={(e) => onPointerDown(e, editable)}
      onPointerEnter={() => onHoverChange(editable.editId)}
      onPointerLeave={() => onHoverChange(null)}
    />
  );
}
