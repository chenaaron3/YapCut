import { create } from "zustand";

import {
  isSelected,
  replaceSelection,
  selectWordRange,
  toggleSelection,
  type Selection,
} from "~/editor/lib/selection";

export { isSelected };
export type { Selection };

type SelectionState = {
  selection: Selection | null;
};

type SelectionActions = {
  setSelection: (selection: Selection | null) => void;
  /**
   * Select by kind + id. Pass `toggle: true` to add/remove from multi-select.
   * `id: null` clears selection of that kind.
   */
  select: (
    kind: Selection["kind"],
    id: number | null,
    toggle?: boolean,
  ) => void;
  selectWordRange: (start: number, end: number) => void;
  clearSelection: () => void;
};

/** Lazy import avoids circular init with editor store. */
function seekEditStart(id: number) {
  void import("~/editor/store").then(({ useEditor }) => {
    const editor = useEditor.getState();
    const edit = editor.config?.edits.find((e) => e.id === id);
    if (!edit) return;
    if (editor.timelineSec < edit.start || editor.timelineSec >= edit.end) {
      editor.seekTimeline(edit.start);
    }
  });
}

export const useSelection = create<SelectionState & SelectionActions>(
  (set, get) => ({
    selection: null,

    setSelection: (selection) => set({ selection }),

    select: (kind, id, toggle = false) => {
      if (id == null) {
        set({
          selection:
            get().selection?.kind === kind ? null : get().selection,
        });
        return;
      }

      if (toggle) {
        set({ selection: toggleSelection(get().selection, kind, id) });
      } else {
        set({ selection: replaceSelection(kind, [id]) });
      }

      if (
        kind === "edit" &&
        isSelected(get().selection, "edit", id)
      ) {
        seekEditStart(id);
      }
    },

    selectWordRange: (start, end) => {
      set({ selection: selectWordRange(start, end) });
    },

    clearSelection: () => set({ selection: null }),
  }),
);

export function useIsSelected(kind: Selection["kind"], id: number): boolean {
  return useSelection((s) => isSelected(s.selection, kind, id));
}
