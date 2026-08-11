import {
  isSelected,
  type SelectionId,
  type SelectionKind,
} from "~/editor/lib/selection";
import { useSelection } from "~/editor/selection-store";
import { useEditor } from "~/editor/store";

/**
 * Reactive selection checker (includes A-roll asset ownership fallbacks).
 * Prefer this in UI over calling `isSelected` + manual store deps.
 */
export function useIsSelected(): (
  kind: SelectionKind,
  id: SelectionId,
) => boolean {
  const selection = useSelection((s) => s.selection);
  const config = useEditor((s) => s.config);
  const assets = useEditor((s) => s.assets);
  const getGlobalWords = useEditor((s) => s.getGlobalWords);
  const getLayout = useEditor((s) => s.getLayout);

  return (kind, id) =>
    isSelected(selection, kind, id, {
      config,
      assets,
      getGlobalWords,
      getLayout,
    });
}
