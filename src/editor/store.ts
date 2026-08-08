import { produce } from "immer";
import { create } from "zustand";

import {
  applyArollCellAction,
  buildArollLayout,
  clampTimelineSec,
  deleteTimelineRange,
  keepCellIdForArollIndex,
  layoutTimelineDuration,
  outputToTimelineSec,
  setArollKeepEdge as applyArollKeepEdge,
  snapTimelineSec,
  timelineToOutputSec,
  type ArollLayoutCell,
} from "~/domain/arolls";
import {
  patchEditRange,
  placeEdit,
  removeEdit,
  type EditSeed,
} from "~/domain/edits";
import {
  PROJECT_FPS,
  type ProjectConfig,
} from "~/domain/project-config";
import { projectTimelineWords } from "~/domain/projection";
import type { GlobalTranscriptWord, TranscriptWord } from "~/domain/transcript";
import { wordActionRange } from "~/editor/lib/word-selection";
import { useSelection } from "~/editor/selection-store";
import { buildProjectProps } from "~/remotion/build-props";
import {
  COMPOSITION_FPS,
  COMPOSITION_HEIGHT,
  COMPOSITION_WIDTH,
} from "~/remotion/constants";
import type { ProjectProps } from "~/remotion/types";

export type EditorAsset = {
  id: string;
  kind: "video" | "image" | "audio";
  playbackUrl: string;
  durationSec: number | null;
  originalFilename: string | null;
  sortOrder: number;
};

type Snapshot = {
  config: ProjectConfig;
  transcriptsByAssetId: Record<string, TranscriptWord[]>;
};

type EditorState = {
  loadState: "idle" | "loading" | "ready" | "error";
  error: string | null;
  projectId: string | null;
  title: string;
  status: string | null;
  config: ProjectConfig | null;
  configUpdatedAt: string | null;
  assets: EditorAsset[];
  transcriptsByAssetId: Record<string, TranscriptWord[]>;
  props: ProjectProps | null;
  configDirty: boolean;
  transcriptsDirty: boolean;
  saving: boolean;
  /** Remotion output frame (compacted). */
  frame: number;
  /** Expanded timeline seconds (gaps count) — config + View playhead. */
  timelineSec: number;
  pxPerSec: number;
  fps: number;
};

type EditorActions = {
  hydrateFromServer: (data: {
    id: string;
    title: string | null;
    status: string;
    config: ProjectConfig;
    configUpdatedAt: string | null;
    assets: EditorAsset[];
    transcripts: Array<{
      assetId: string;
      words: TranscriptWord[];
    }>;
  }) => void;
  save: () => Promise<void>;
  /** Seek by expanded timeline seconds (snaps out of gaps for the player). */
  seekTimeline: (timelineSec: number) => void;
  seekFrame: (frame: number) => void;
  seekBySeconds: (delta: number) => void;
  setPxPerSec: (v: number) => void;
  beginGesture: () => void;
  undo: () => void;
  redo: () => void;
  deleteSelection: () => boolean;
  toggleWordEmphasis: (globalIndex: number) => void;
  setWordEmphasis: (globalIndex: number, emphasized: boolean) => void;
  /** Place an edit over the word (or word selection if it includes this word). */
  placeEditOnWord: (globalIndex: number, seed: EditSeed) => void;
  /** Cut the word (or word selection if it includes this word). */
  cutWord: (globalIndex: number) => void;
  patchSelectedEditRange: (start: number, end: number) => void;
  /** Live range patch for a specific edit (timeline handle drag). */
  patchEditRangeById: (id: number, start: number, end: number) => void;
  /** Live keep-edge patch; `arollIndex` is index in `config.arolls`. */
  setArollKeepEdge: (
    arollIndex: number,
    edge: "start" | "end",
    targetTimelineSec: number,
  ) => void;
  getGlobalWords: () => GlobalTranscriptWord[];
  getDurationSec: () => number;
  getLayout: () => ArollLayoutCell[];
};

let history: Snapshot[] = [];
let future: Snapshot[] = [];
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let scrubbing = false;
/** Last successfully persisted refs — dirty flags compare against these. */
let lastSavedConfig: ProjectConfig | null = null;
let lastSavedTranscripts: Record<string, TranscriptWord[]> | null = null;
let saveConfigMutate:
  | ((input: {
      id: string;
      config: ProjectConfig;
    }) => Promise<{ configUpdatedAt: string }>)
  | null = null;
let saveWordsMutate:
  | ((input: {
      projectId: string;
      assetId: string;
      words: TranscriptWord[];
    }) => Promise<{ ok: true }>)
  | null = null;

export function setTimelineScrubbing(active: boolean) {
  scrubbing = active;
}

export function isTimelineScrubbing() {
  return scrubbing;
}

/** Wire tRPC mutators from the React tree (store itself is not a hook). */
export function bindEditorSavers(options: {
  updateConfig: NonNullable<typeof saveConfigMutate>;
  updateTranscriptWords: NonNullable<typeof saveWordsMutate>;
}) {
  saveConfigMutate = options.updateConfig;
  saveWordsMutate = options.updateTranscriptWords;
}

function mediaUrlMap(assets: EditorAsset[]): Map<string, string> {
  return new Map(assets.map((a) => [a.id, a.playbackUrl]));
}

function transcriptMap(
  transcriptsByAssetId: Record<string, TranscriptWord[]>,
): Map<string, TranscriptWord[]> {
  return new Map(Object.entries(transcriptsByAssetId));
}

function durationMap(assets: EditorAsset[]): Map<string, number> {
  return new Map(assets.map((a) => [a.id, a.durationSec ?? 0]));
}

function recomputeProps(state: {
  config: ProjectConfig;
  assets: EditorAsset[];
  transcriptsByAssetId: Record<string, TranscriptWord[]>;
  fps: number;
}): ProjectProps {
  return buildProjectProps({
    config: state.config,
    mediaUrls: mediaUrlMap(state.assets),
    transcriptsByAssetId: transcriptMap(state.transcriptsByAssetId),
    assetDurationSec: durationMap(state.assets),
    fps: state.fps,
  });
}

function layoutFor(
  config: ProjectConfig,
  assets: EditorAsset[],
): ArollLayoutCell[] {
  return buildArollLayout(config.arolls, durationMap(assets));
}

export const useEditor = create<EditorState & EditorActions>((set, get) => {
  const pushHistory = (snap: Snapshot) => {
    history.push(snap);
    if (history.length > 50) history.shift();
    future.length = 0;
  };

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void get().save(), 400);
  };

  /** History holds immutable refs (Model/Controller use immer; never mutate in place). */
  const snapshot = (): Snapshot | null => {
    const { config, transcriptsByAssetId } = get();
    if (!config) return null;
    return { config, transcriptsByAssetId };
  };

  const commit = (next: Snapshot, options?: { live?: boolean }) => {
    const prev = snapshot();
    if (!options?.live && prev) pushHistory(prev);

    const state = get();
    const configDirty = next.config !== lastSavedConfig;
    const transcriptsDirty =
      next.transcriptsByAssetId !== lastSavedTranscripts;
    const props = recomputeProps({
      config: next.config,
      assets: state.assets,
      transcriptsByAssetId: next.transcriptsByAssetId,
      fps: state.fps,
    });
    const layout = layoutFor(next.config, state.assets);
    const timelineSec = snapTimelineSec(
      layout,
      clampTimelineSec(layout, state.timelineSec),
    );
    const outputSec = timelineToOutputSec(layout, timelineSec);

    set({
      config: next.config,
      transcriptsByAssetId: next.transcriptsByAssetId,
      props,
      timelineSec,
      frame: Math.round(outputSec * state.fps),
      configDirty,
      transcriptsDirty,
      error: null,
    });
    if (configDirty || transcriptsDirty) scheduleSave();
  };

  const restore = (snap: Snapshot) => {
    const state = get();
    const configDirty = snap.config !== lastSavedConfig;
    const transcriptsDirty =
      snap.transcriptsByAssetId !== lastSavedTranscripts;
    const props = recomputeProps({
      config: snap.config,
      assets: state.assets,
      transcriptsByAssetId: snap.transcriptsByAssetId,
      fps: state.fps,
    });
    set({
      config: snap.config,
      transcriptsByAssetId: snap.transcriptsByAssetId,
      props,
      configDirty,
      transcriptsDirty,
    });
    if (configDirty || transcriptsDirty) scheduleSave();
  };

  const seekTimeline = (timelineSec: number) => {
    const { config, assets, fps } = get();
    if (!config) return;
    const layout = layoutFor(config, assets);
    const snapped = snapTimelineSec(
      layout,
      clampTimelineSec(layout, timelineSec),
    );
    const outputSec = timelineToOutputSec(layout, snapped);
    set({
      timelineSec: snapped,
      frame: Math.round(outputSec * fps),
    });
  };

  return {
    loadState: "idle",
    error: null,
    projectId: null,
    title: "",
    status: null,
    config: null,
    configUpdatedAt: null,
    assets: [],
    transcriptsByAssetId: {},
    props: null,
    configDirty: false,
    transcriptsDirty: false,
    saving: false,
    frame: 0,
    timelineSec: 0,
    pxPerSec: 40,
    fps: COMPOSITION_FPS || PROJECT_FPS,

    hydrateFromServer: (data) => {
      history = [];
      future = [];
      const transcriptsByAssetId: Record<string, TranscriptWord[]> = {};
      for (const t of data.transcripts) {
        transcriptsByAssetId[t.assetId] = t.words;
      }
      lastSavedConfig = data.config;
      lastSavedTranscripts = transcriptsByAssetId;
      const fps = COMPOSITION_FPS;
      const props = recomputeProps({
        config: data.config,
        assets: data.assets,
        transcriptsByAssetId,
        fps,
      });
      set({
        loadState: "ready",
        error: null,
        projectId: data.id,
        title: data.title?.trim() || "Untitled",
        status: data.status,
        config: data.config,
        configUpdatedAt: data.configUpdatedAt,
        assets: data.assets,
        transcriptsByAssetId,
        props,
        configDirty: false,
        transcriptsDirty: false,
        saving: false,
        frame: 0,
        timelineSec: 0,
        fps,
      });
    },

    save: async () => {
      const state = get();
      if (!state.projectId || !state.config) return;
      if (!state.configDirty && !state.transcriptsDirty) return;
      if (state.saving) return;
      if (state.configDirty && !saveConfigMutate) return;
      if (state.transcriptsDirty && !saveWordsMutate) return;

      set({ saving: true, error: null });
      const projectId = state.projectId;
      const savedConfig = state.config;
      const savedTranscripts = state.transcriptsByAssetId;
      const didConfig = state.configDirty;
      const didTranscripts = state.transcriptsDirty;

      try {
        let configUpdatedAt = state.configUpdatedAt;
        if (didConfig && saveConfigMutate) {
          const result = await saveConfigMutate({
            id: projectId,
            config: savedConfig,
          });
          configUpdatedAt = result.configUpdatedAt;
          lastSavedConfig = savedConfig;
        }

        if (didTranscripts && saveWordsMutate) {
          for (const [assetId, words] of Object.entries(savedTranscripts)) {
            await saveWordsMutate({
              projectId,
              assetId,
              words,
            });
          }
          lastSavedTranscripts = savedTranscripts;
        }

        const current = get();
        const configDirty = current.config !== lastSavedConfig;
        const transcriptsDirty =
          current.transcriptsByAssetId !== lastSavedTranscripts;

        set({
          saving: false,
          configDirty,
          transcriptsDirty,
          configUpdatedAt,
        });
        if (configDirty || transcriptsDirty) scheduleSave();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to save";
        set({ saving: false, error: message });
      }
    },

    seekTimeline,

    seekFrame: (frame) => {
      const { config, assets, fps } = get();
      if (!config) return;
      const layout = layoutFor(config, assets);
      const outputSec = Math.max(0, frame / fps);
      const nextFrame = Math.round(outputSec * fps);
      if (nextFrame === get().frame) return;
      const timelineSec = outputToTimelineSec(layout, outputSec);
      set({ frame: nextFrame, timelineSec });
    },

    seekBySeconds: (delta) => {
      get().seekTimeline(get().timelineSec + delta);
    },

    setPxPerSec: (pxPerSec) => set({ pxPerSec }),

    beginGesture: () => {
      const snap = snapshot();
      if (snap) pushHistory(snap);
    },

    undo: () => {
      const current = snapshot();
      const prev = history.pop();
      if (!current || !prev) return;
      future.push(current);
      restore(prev);
    },

    redo: () => {
      const current = snapshot();
      const next = future.pop();
      if (!current || !next) return;
      history.push(current);
      restore(next);
    },

    deleteSelection: () => {
      const { config, transcriptsByAssetId, assets } = get();
      const { selection, clearSelection, setSelection } =
        useSelection.getState();
      if (!config || !selection) return false;

      const durations = durationMap(assets);

      if (selection.kind === "aroll") {
        if (selection.ids.length === 0) return false;
        const layout = buildArollLayout(config.arolls, durations);
        const cells = selection.ids
          .map((id) => layout.find((c) => c.id === id))
          .filter((c): c is NonNullable<typeof c> => c != null);
        if (cells.length === 0) return false;

        // Delete keeps from the end so earlier timeline coords stay valid.
        const keeps = cells
          .filter((c) => c.kind === "keep")
          .sort((a, b) => b.timeline.start - a.timeline.start);
        const gaps = cells.filter((c) => c.kind === "gap");

        let next = config;
        for (const cell of keeps) {
          next = applyArollCellAction(next, cell, durations);
        }
        for (const cell of gaps) {
          next = applyArollCellAction(next, cell, durations);
        }

        commit({ config: next, transcriptsByAssetId });
        clearSelection();
        return true;
      }

      if (selection.kind === "edit") {
        if (selection.ids.length === 0) return false;
        let next = config;
        for (const id of selection.ids) {
          next = removeEdit(next, id);
        }
        commit({
          config: next,
          transcriptsByAssetId,
        });
        clearSelection();
        return true;
      }

      if (selection.kind === "word") {
        const words = projectTimelineWords(
          config.arolls,
          transcriptMap(transcriptsByAssetId),
          durations,
        );
        const indices = selection.ids.filter(
          (id): id is number => typeof id === "number",
        );
        if (indices.length === 0) return false;
        const selected = indices
          .map((i) => words[i])
          .filter((w): w is GlobalTranscriptWord => w != null);
        if (selected.length === 0) return false;
        const start = Math.min(...selected.map((w) => w.start));
        const end = Math.max(...selected.map((w) => w.end));
        commit({
          config: deleteTimelineRange(config, { start, end }, durations),
          transcriptsByAssetId,
        });
        clearSelection();
        setSelection(null);
        return true;
      }

      return false;
    },

    toggleWordEmphasis: (globalIndex) => {
      const words = get().getGlobalWords();
      const word = words[globalIndex];
      if (!word) return;
      get().setWordEmphasis(globalIndex, !word.emphasized);
    },

    setWordEmphasis: (globalIndex, emphasized) => {
      const { config, transcriptsByAssetId, assets } = get();
      if (!config) return;
      const words = projectTimelineWords(
        config.arolls,
        transcriptMap(transcriptsByAssetId),
        durationMap(assets),
      );
      const word = words[globalIndex];
      if (!word) return;

      commit({
        config,
        transcriptsByAssetId: produce(transcriptsByAssetId, (draft) => {
          const local = draft[word.assetId]?.[word.localIndex];
          if (!local) return;
          local.emphasized = emphasized ? true : undefined;
        }),
      });
    },

    placeEditOnWord: (globalIndex, seed) => {
      const { config, transcriptsByAssetId, assets } = get();
      if (!config) return;
      const words = get().getGlobalWords();
      const word = words[globalIndex];
      if (!word) return;
      const { selection } = useSelection.getState();
      const range = wordActionRange(selection, word, words);
      const duration = layoutTimelineDuration(layoutFor(config, assets));
      const prevIds = new Set(config.edits.map((e) => e.id));
      const next = placeEdit(config, range, duration, seed);
      if (next === config) return;
      commit({ config: next, transcriptsByAssetId });
      const created = next.edits.find((e) => !prevIds.has(e.id));
      if (created) useSelection.getState().select("edit", created.id);
    },

    cutWord: (globalIndex) => {
      const { config, transcriptsByAssetId, assets } = get();
      if (!config) return;
      const words = get().getGlobalWords();
      const word = words[globalIndex];
      if (!word) return;
      const { selection, clearSelection } = useSelection.getState();
      const range = wordActionRange(selection, word, words);
      commit({
        config: deleteTimelineRange(
          config,
          range,
          durationMap(assets),
        ),
        transcriptsByAssetId,
      });
      clearSelection();
    },

    patchSelectedEditRange: (start, end) => {
      const { selection } = useSelection.getState();
      if (!selection || selection.kind !== "edit") return;
      const id = selection.ids[0];
      if (id == null) return;
      get().patchEditRangeById(id, start, end);
    },

    patchEditRangeById: (id, start, end) => {
      const { config, transcriptsByAssetId, assets } = get();
      if (!config) return;
      const duration = layoutTimelineDuration(layoutFor(config, assets));
      commit(
        {
          config: patchEditRange(config, id, { start, end }, duration),
          transcriptsByAssetId,
        },
        { live: true },
      );
    },

    setArollKeepEdge: (arollIndex, edge, targetTimelineSec) => {
      const { config, transcriptsByAssetId, assets } = get();
      if (!config) return;
      const durations = durationMap(assets);
      const next = applyArollKeepEdge(
        config,
        arollIndex,
        edge,
        targetTimelineSec,
        durations,
      );
      if (next === config) return;
      commit({ config: next, transcriptsByAssetId }, { live: true });

      // Layout cell ids can shift when gaps appear/disappear — keep selection on the keep.
      const layout = layoutFor(next, assets);
      const cellId = keepCellIdForArollIndex(layout, arollIndex);
      if (cellId == null) return;
      const { selection, setSelection } = useSelection.getState();
      if (
        selection?.kind === "aroll" &&
        selection.ids.length === 1 &&
        selection.ids[0] !== cellId
      ) {
        setSelection({ kind: "aroll", ids: [cellId] });
      }
    },

    getGlobalWords: () => {
      const { config, transcriptsByAssetId, assets } = get();
      if (!config) return [];
      return projectTimelineWords(
        config.arolls,
        transcriptMap(transcriptsByAssetId),
        durationMap(assets),
      );
    },

    getDurationSec: () => {
      const { config, assets } = get();
      if (!config) return 0;
      return layoutTimelineDuration(layoutFor(config, assets));
    },

    getLayout: () => {
      const { config, assets } = get();
      if (!config) return [];
      return layoutFor(config, assets);
    },
  };
});

export function useGlobalWords(): GlobalTranscriptWord[] {
  const config = useEditor((s) => s.config);
  const transcriptsByAssetId = useEditor((s) => s.transcriptsByAssetId);
  const assets = useEditor((s) => s.assets);
  if (!config) return [];
  return projectTimelineWords(
    config.arolls,
    transcriptMap(transcriptsByAssetId),
    durationMap(assets),
  );
}

export const EDITOR_COMPOSITION = {
  width: COMPOSITION_WIDTH,
  height: COMPOSITION_HEIGHT,
  fps: COMPOSITION_FPS,
} as const;
