import { create } from "zustand";

import {
  DEFAULT_TRANSCRIPT_CHROME_VISIBILITY,
  type TranscriptChromeGroup,
  type TranscriptChromeVisibility,
} from "~/editor/lib/transcript-chrome-visibility";

type State = {
  /** Which edit kinds show chrome in the transcript (session-only). */
  visible: TranscriptChromeVisibility;
  toggleVisible: (group: TranscriptChromeGroup) => void;
  setGroupsVisible: (
    groups: readonly TranscriptChromeGroup[],
    on: boolean,
  ) => void;

  /** At most one marker cluster expanded (`wordIndex:before` | `wordIndex:after`). */
  expandedClusterId: string | null;
  expandCluster: (clusterId: string) => void;
  collapseCluster: () => void;
  toggleCluster: (clusterId: string) => void;

  /** Transitions tab drag in flight — transcript shows all valid drop words. */
  transitionDragActive: boolean;
  setTransitionDragActive: (on: boolean) => void;
};

/** Session-only transcript UI: chrome visibility + marker cluster expand. */
export const useTranscriptUi = create<State>((set, get) => ({
  visible: { ...DEFAULT_TRANSCRIPT_CHROME_VISIBILITY },
  toggleVisible: (group) =>
    set((s) => ({
      visible: { ...s.visible, [group]: !s.visible[group] },
    })),
  setGroupsVisible: (groups, on) =>
    set((s) => {
      const visible = { ...s.visible };
      for (const group of groups) visible[group] = on;
      return { visible };
    }),

  expandedClusterId: null,
  expandCluster: (clusterId) => set({ expandedClusterId: clusterId }),
  collapseCluster: () => set({ expandedClusterId: null }),
  toggleCluster: (clusterId) =>
    set({
      expandedClusterId:
        get().expandedClusterId === clusterId ? null : clusterId,
    }),

  transitionDragActive: false,
  setTransitionDragActive: (on) => set({ transitionDragActive: on }),
}));
