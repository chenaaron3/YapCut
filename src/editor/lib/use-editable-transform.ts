import { isBrollActiveAt } from "~/domain/broll";
import { transformOf, type Transform } from "~/domain/transform";
import { isZoomActiveAt } from "~/domain/zoom";
import { primaryId } from "~/editor/lib/selection";
import { useSelection } from "~/editor/selection-store";
import { useEditor } from "~/editor/store";
import {
  COMPOSITION_HEIGHT,
  COMPOSITION_WIDTH,
} from "~/remotion/constants";

export type EditableTransform = {
  editId: number;
  transform: Transform;
  width: number;
  height: number;
  label: string;
};

/**
 * Selected b-roll or zoom that is currently visible under the playhead.
 * Drives the shared player TransformOverlay.
 */
export function useEditableTransform(): EditableTransform | null {
  const id = useSelection((s) => {
    if (s.selection?.kind !== "edit") return null;
    return primaryId(s.selection);
  });
  const edit = useEditor((s) => {
    if (id == null || !s.config) return null;
    return s.config.edits.find((e) => e.id === id) ?? null;
  });
  const asset = useEditor((s) => {
    if (!edit || edit.kind !== "broll") return null;
    return s.assets.find((a) => a.id === edit.assetId) ?? null;
  });
  const timelineSec = useEditor((s) => s.timelineSec);

  if (!edit) return null;

  if (edit.kind === "zoom") {
    if (!isZoomActiveAt(edit, timelineSec)) return null;
    return {
      editId: edit.id,
      transform: transformOf(edit),
      width: COMPOSITION_WIDTH,
      height: COMPOSITION_HEIGHT,
      label: "Zoom",
    };
  }

  if (edit.kind !== "broll") return null;
  if (!isBrollActiveAt(edit, timelineSec)) return null;
  if (!asset) return null;
  if (asset.kind !== "image" && asset.kind !== "video") return null;
  if (asset.width == null || asset.height == null) return null;
  if (asset.width <= 0 || asset.height <= 0) return null;

  return {
    editId: edit.id,
    transform: transformOf(edit),
    width: asset.width,
    height: asset.height,
    label: asset.originalFilename ?? asset.id.slice(0, 8),
  };
}
