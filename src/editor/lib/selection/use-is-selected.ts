import {
  isSelected,
  type SelectionId,
  type SelectionKind,
} from "~/editor/lib/selection/selection";
import { useSelection } from "~/editor/selection-store";
import { useEditor } from "~/editor/store";

/**
 * Reactive selection checker (includes A-roll asset ownership fallbacks).
 * Prefer this in UI over calling `isSelected` + manual store deps.
 *
 * Pass `kinds` to ignore unrelated selection updates (e.g. word playback
 * sync should not re-render edit tracks).
 */
export function useIsSelected(
  kinds?: readonly SelectionKind[],
): (kind: SelectionKind, id: SelectionId) => boolean {
  const selection = useSelection((s) => {
    const next = s.selection;
    if (!next) return null;
    if (kinds && !kinds.includes(next.kind)) return null;
    return next;
  });
  // Don't subscribe to config — cosmetic edit patches would re-render every
  // track cell. Fallbacks read fresh state when the checker runs (after a
  // topology-driven parent re-render, or selection change).
  return (kind, id) => {
    const editor = useEditor.getState();
    return isSelected(selection, kind, id, {
      config: editor.config,
      assets: editor.assets,
      getGlobalWords: editor.getGlobalWords,
      getLayout: editor.getLayout,
    });
  };
}

/** True when this exact entity is selected — stable for unrelated selection changes. */
export function useEntitySelected(
  kind: SelectionKind,
  id: SelectionId,
  assetId?: string,
): boolean {
  return useSelection((s) => {
    const selection = s.selection;
    if (!selection) return false;

    // Fast path for word playback highlight (no editor-store subscription).
    if (kind === "word" && typeof id === "number") {
      if (selection.kind === "word") return selection.ids.includes(id);
      if (selection.kind === "aroll" && assetId != null) {
        return selection.ids.includes(assetId);
      }
      return false;
    }

    if (kind === "edit" && typeof id === "number" && selection.kind === "edit") {
      return selection.ids.includes(id);
    }

    const editor = useEditor.getState();
    return isSelected(selection, kind, id, {
      config: editor.config,
      assets: editor.assets,
      getGlobalWords: editor.getGlobalWords,
      getLayout: editor.getLayout,
    });
  });
}
