import { useSyncExternalStore } from "react";

import { isBrollActiveAt } from "~/domain/broll";
import { isMotionEdit } from "~/domain/motion";
import { isTextBaseEdit } from "~/domain/project-config";
import { isStickerEdit, STICKER_BOX_PX, stickerLabel } from "~/domain/sticker";
import { transformOf } from "~/domain/transform";
import { isZoomActiveAt } from "~/domain/zoom";
import { primaryId } from "~/editor/lib/selection";
import { useSelection } from "~/editor/selection-store";
import { useEditor } from "~/editor/store";
import {
  COMPOSITION_HEIGHT,
  COMPOSITION_WIDTH,
} from "~/remotion/helpers/constants";
import {
  getOverlayMeasure,
  getOverlayMeasuresRevision,
  OVERLAY_MEASURE_FALLBACK,
  subscribeOverlayMeasures,
} from "~/remotion/helpers/overlay-measure";

import type { Edit, ProjectConfig } from "~/domain/project-config";
import type { Transform } from "~/domain/transform";

/** Paint stack under the player: zoom (a-roll) → b-roll → text overlays. */
export type EditableLayer = "zoom" | "broll" | "overlay";

export type EditableTransform = {
  editId: number;
  transform: Transform;
  width: number;
  height: number;
  label: string;
  layer: EditableLayer;
};

type AssetSize = {
  id: string;
  kind: string;
  width: number | null;
  height: number | null;
  originalFilename?: string | null;
};

const LAYER_ORDER: Record<EditableLayer, number> = {
  zoom: 0,
  broll: 1,
  overlay: 2,
};

function editableForEdit(
  edit: Edit,
  timelineSec: number,
  assets: readonly AssetSize[],
  overlaySize: { width: number; height: number } | null,
): EditableTransform | null {
  if (edit.kind === "zoom") {
    if (!isZoomActiveAt(edit, timelineSec)) return null;
    return {
      editId: edit.id,
      transform: transformOf(edit),
      width: COMPOSITION_WIDTH,
      height: COMPOSITION_HEIGHT,
      label: "Zoom",
      layer: "zoom",
    };
  }

  if (isTextBaseEdit(edit)) {
    if (timelineSec < edit.start || timelineSec >= edit.end) return null;
    const size = overlaySize ?? OVERLAY_MEASURE_FALLBACK;
    return {
      editId: edit.id,
      transform: transformOf(edit),
      width: size.width,
      height: size.height,
      label:
        edit.heading.trim() ||
        (edit.type === "listicle" ? "Listicle" : "Title"),
      layer: "overlay",
    };
  }

  if (isMotionEdit(edit)) {
    if (timelineSec < edit.start || timelineSec >= edit.end) return null;
    const size = overlaySize ?? OVERLAY_MEASURE_FALLBACK;
    return {
      editId: edit.id,
      transform: transformOf(edit),
      width: size.width,
      height: size.height,
      label: "Motion",
      layer: "overlay",
    };
  }

  if (isStickerEdit(edit)) {
    if (timelineSec < edit.start || timelineSec >= edit.end) return null;
    const size = overlaySize ?? {
      width: STICKER_BOX_PX,
      height: STICKER_BOX_PX,
    };
    return {
      editId: edit.id,
      transform: transformOf(edit),
      width: size.width,
      height: size.height,
      label: stickerLabel(edit),
      layer: "overlay",
    };
  }

  if (edit.kind !== "broll") return null;
  if (!isBrollActiveAt(edit, timelineSec)) return null;
  const asset = assets.find((a) => a.id === edit.assetId);
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
    layer: "broll",
  };
}

/**
 * Transformable edits visible at `timelineSec`, bottom → top (matches Remotion
 * stack: zoom → b-roll → text). Later same-layer edits paint above earlier.
 */
export function listEditableTransforms(
  config: ProjectConfig | null,
  assets: readonly AssetSize[],
  timelineSec: number,
  overlaySizeFor: (editId: number) => { width: number; height: number } | null,
): EditableTransform[] {
  if (!config) return [];
  const out: EditableTransform[] = [];
  for (const edit of config.edits) {
    const item = editableForEdit(
      edit,
      timelineSec,
      assets,
      overlaySizeFor(edit.id),
    );
    if (item) out.push(item);
  }
  out.sort((a, b) => {
    const layer = LAYER_ORDER[a.layer] - LAYER_ORDER[b.layer];
    if (layer !== 0) return layer;
    return a.editId - b.editId;
  });
  return out;
}

/**
 * All transformable edits currently visible under the playhead.
 * Drives player hit-testing + TransformOverlay chrome.
 */
export function useEditableTransforms(): EditableTransform[] {
  const config = useEditor((s) => s.config);
  const assets = useEditor((s) => s.assets);
  const timelineSec = useEditor((s) => s.timelineSec);
  useSyncExternalStore(
    subscribeOverlayMeasures,
    getOverlayMeasuresRevision,
    () => 0,
  );

  return listEditableTransforms(config, assets, timelineSec, getOverlayMeasure);
}

/**
 * Selected b-roll, overlay, or zoom that is currently visible under the playhead.
 */
export function useEditableTransform(): EditableTransform | null {
  const id = useSelection((s) => {
    if (s.selection?.kind !== "edit") return null;
    return primaryId(s.selection);
  });
  const all = useEditableTransforms();
  if (id == null) return null;
  return all.find((e) => e.editId === id) ?? null;
}
