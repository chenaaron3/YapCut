import { create } from "zustand";

import {
  isSelected,
  replaceSelection,
  selectWordRange,
  toggleSelection,
} from "~/editor/lib/selection";

import type {
  ProjectPanel,
  Selection,
  SelectionId,
  SelectionKind,
} from "~/editor/lib/selection";

export { isSelected };
export type { ProjectPanel, Selection, SelectionId, SelectionKind };

type SelectionState = {
  selection: Selection | null;
  /** Project-field inspector (captions, music). Mutually exclusive with selection. */
  projectPanel: ProjectPanel | null;
};

type SelectionActions = {
  setSelection: (selection: Selection | null) => void;
  /**
   * Select by kind + id. Pass `toggle: true` to add/remove from multi-select.
   * `id: null` clears selection of that kind.
   */
  select: (
    kind: SelectionKind,
    id: SelectionId | null,
    toggle?: boolean,
  ) => void;
  /** Open the Captions project-field inspector. */
  openCaptionsPanel: () => void;
  /** Open the Music project-field inspector. */
  openMusicPanel: () => void;
  /** Open the Project settings inspector. */
  openSettingsPanel: () => void;
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
    projectPanel: null,

    setSelection: (selection) => set({ selection, projectPanel: null }),

    select: (kind, id, toggle = false) => {
      if (id == null) {
        set({
          selection: get().selection?.kind === kind ? null : get().selection,
          projectPanel: null,
        });
        return;
      }

      if (toggle) {
        set({
          selection: toggleSelection(get().selection, kind, id),
          projectPanel: null,
        });
      } else {
        set({
          selection: replaceSelection(kind, [id]),
          projectPanel: null,
        });
      }

      if (
        kind === "edit" &&
        typeof id === "number" &&
        isSelected(get().selection, "edit", id)
      ) {
        seekEditStart(id);
      }
    },

    openCaptionsPanel: () => {
      set({ selection: null, projectPanel: "captions" });
    },

    openMusicPanel: () => {
      set({ selection: null, projectPanel: "music" });
    },

    openSettingsPanel: () => {
      set({ selection: null, projectPanel: "settings" });
    },

    selectWordRange: (start, end) => {
      set({ selection: selectWordRange(start, end), projectPanel: null });
    },

    clearSelection: () => set({ selection: null, projectPanel: null }),
  }),
);

