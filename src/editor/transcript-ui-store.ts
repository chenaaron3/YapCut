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

  /** At most one marker cluster expanded (word globalIndex). */
  expandedWordIndex: number | null;
  expandCluster: (wordIndex: number) => void;
  collapseCluster: () => void;
  toggleCluster: (wordIndex: number) => void;
};

/** Session-only transcript UI: chrome visibility + marker cluster expand. */
export const useTranscriptUi = create<State>((set, get) => ({
  visible: { ...DEFAULT_TRANSCRIPT_CHROME_VISIBILITY },
  toggleVisible: (group) =>
    set((s) => ({
      visible: { ...s.visible, [group]: !s.visible[group] },
    })),

  expandedWordIndex: null,
  expandCluster: (wordIndex) => set({ expandedWordIndex: wordIndex }),
  collapseCluster: () => set({ expandedWordIndex: null }),
  toggleCluster: (wordIndex) =>
    set({
      expandedWordIndex:
        get().expandedWordIndex === wordIndex ? null : wordIndex,
    }),
}));
