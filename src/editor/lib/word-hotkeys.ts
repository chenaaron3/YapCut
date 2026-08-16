import { quoteSeed } from "~/domain/quote";
import { textSeed } from "~/domain/vfx";
import { zoomSeed } from "~/domain/zoom";
import { useSelection } from "~/editor/selection-store";
import { useEditor } from "~/editor/store";

export const WORD_SELECTION_HOTKEYS = {
  emphasis: "1",
  zoom: "2",
  quote: "3",
  text: "4",
} as const;

/** Selected word indices, or empty when the selection is not words. */
function selectedWordIndices(): number[] {
  const { selection } = useSelection.getState();
  if (selection?.kind !== "word") return [];
  return selection.ids.filter((id): id is number => typeof id === "number");
}

function applyEmphasisToSelection(indices: readonly number[]): boolean {
  const editor = useEditor.getState();
  const words = editor.getGlobalWords();
  const selected = indices
    .map((i) => words[i])
    .filter((w): w is NonNullable<typeof w> => w != null);
  if (selected.length === 0) return false;
  const emphasized = !selected.every((w) => w.emphasized);
  editor.patchWords(
    selected.map((w) => w.globalIndex),
    { emphasized },
  );
  return true;
}

/**
 * Place text / emphasis / quote / zoom on the current word selection.
 * No-op (false) when no words are selected.
 */
export function applyWordSelectionHotkey(key: string): boolean {
  const indices = selectedWordIndices();
  if (indices.length === 0) return false;

  const editor = useEditor.getState();
  const first = indices[0]!;

  switch (key) {
    case WORD_SELECTION_HOTKEYS.emphasis:
      return applyEmphasisToSelection(indices);
    case WORD_SELECTION_HOTKEYS.zoom:
      editor.placeEditOnWord(first, zoomSeed());
      return true;
    case WORD_SELECTION_HOTKEYS.quote:
      editor.placeEditOnWord(first, quoteSeed());
      return true;
    case WORD_SELECTION_HOTKEYS.text:
      editor.placeEditOnWord(first, textSeed());
      return true;
    default:
      return false;
  }
}
