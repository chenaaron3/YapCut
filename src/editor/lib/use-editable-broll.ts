import { isBrollActiveAt } from "~/domain/broll";
import { transformOf, type Transform } from "~/domain/transform";
import type { BrollEdit } from "~/domain/project-config";
import { primaryId } from "~/editor/lib/selection";
import { useSelection } from "~/editor/selection-store";
import { useEditor } from "~/editor/store";

export type EditableBroll = {
  edit: BrollEdit;
  transform: Transform;
  width: number;
  height: number;
  mediaKind: "image" | "video";
  srcDurationSec: number | null;
  label: string;
};

/** Selected b-roll that is currently visible under the playhead. */
export function useEditableBroll(): EditableBroll | null {
  const id = useSelection((s) => {
    if (s.selection?.kind !== "edit") return null;
    return primaryId(s.selection);
  });
  const edit = useEditor((s) => {
    if (id == null || !s.config) return null;
    const found = s.config.edits.find((e) => e.id === id);
    return found?.kind === "broll" ? found : null;
  });
  const asset = useEditor((s) =>
    edit ? (s.assets.find((a) => a.id === edit.assetId) ?? null) : null,
  );
  const active = useEditor(
    (s) => edit != null && isBrollActiveAt(edit, s.timelineSec),
  );

  if (!edit || !active || !asset) return null;
  if (asset.kind !== "image" && asset.kind !== "video") return null;
  if (asset.width == null || asset.height == null) return null;
  if (asset.width <= 0 || asset.height <= 0) return null;

  return {
    edit,
    transform: transformOf(edit),
    width: asset.width,
    height: asset.height,
    mediaKind: asset.kind,
    srcDurationSec: asset.durationSec,
    label: asset.originalFilename ?? asset.id.slice(0, 8),
  };
}
