import { produce } from "immer";
import { create } from "zustand";
import { useStoreWithEqualityFn } from "zustand/traditional";

import {
  applyArollCellAction,
  setArollKeepEdge as applyArollKeepEdge,
  buildArollLayout,
  buildArollLayoutFromAssets,
  deleteTimelineRange,
  durationMapFromAssets,
  keepCellIdForArollIndex,
  keepCells,
  reorderArollAssets,
} from "~/domain/arolls";
import { expandWordDeleteRange } from "~/domain/keeps";
import {
  clampTimelineSec,
  layoutTimelineDuration,
  outputToTimelineSec,
  snapTimelineSec,
  timelineToOutputSec,
} from "~/domain/layout-time";
import {
  patchEdit as applyPatchEdit,
  patchEditRange as applyPatchEditRange,
  placeEdit,
  removeEdit,
  type RangeEdge,
} from "~/domain/edits";
import { MUSIC_VOLUME_DEFAULT } from "~/domain/audio/mix-levels";
import {
  clampTimelineRangeToMedia,
  withMediaRefPatch,
  type MediaRefPatch,
} from "~/domain/media";
import { musicFromAsset } from "~/domain/music";
import { PROJECT_FPS } from "~/domain/project-config";
import {
  adjacentKeptWordIndex,
  projectTimelineWords,
  wordIndexAtTimelineSec,
} from "~/domain/projection";
import { primaryId } from "~/editor/lib/selection";
import { snapWordActionRangeToKeeps } from "~/editor/lib/snap";
import { wordActionRange, wordDeleteRange } from "~/editor/lib/word-selection";
import { useSelection } from "~/editor/selection-store";
import { buildProjectProps } from "~/remotion/helpers/build-props";
import {
  COMPOSITION_FPS,
  COMPOSITION_HEIGHT,
  COMPOSITION_WIDTH,
} from "~/remotion/helpers/constants";

import type { SerializedWaveform } from "~/domain/audio/waveform";
import type { ArollLayoutCell } from "~/domain/arolls";
import type { EditPatch, EditSeed } from "~/domain/edits";
import { isListicleEdit } from "~/domain/listicle";
import {
  applyTemplateStylePatch,
  cloneTemplateStyle,
  type EditId,
  type ProjectConfig,
  type TemplateStyle,
} from "~/domain/project-config";
import type { CompanionSfxCueId, CompanionSfxSource } from "~/domain/companion-sfx-map";
import type { EmphasisStyle } from "~/domain/emphasis-style";
import type { TimelineTime } from "~/domain/time";
import type { GlobalTranscriptWord, TranscriptWord } from "~/domain/transcript";
import type { ProjectProps } from "~/remotion/helpers/types";

/** Mutable transcript-word fields (local asset words). */
export type WordPatch = Partial<Pick<TranscriptWord, "emphasized" | "text">>;

export type AudioLibrary = "sfx" | "music";

export type EditorAsset = {
  id: string;
  kind: "video" | "image" | "audio";
  playbackUrl: string;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  originalFilename: string | null;
  sortOrder: number;
  audioLibrary: AudioLibrary | null;
  lufs: number | null;
  truePeakDb: number | null;
  waveform: SerializedWaveform | null;
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
  // —— Hydration / persisting ——
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

  // —— Seek / time ——
  /** Expanded timeline seconds (snaps out of gaps for the player). */
  seekTimeline: (timelineSec: number) => void;
  seekFrame: (frame: number) => void;
  seekBySeconds: (delta: number) => void;
  /** Move selection/playhead to adjacent word when a word is selected. */
  seekAdjacentWord: (direction: -1 | 1) => boolean;
  /** While playing, keep the word under the playhead selected. */
  syncActiveWord: () => void;
  setPxPerSec: (v: number) => void;

  // —— History / gesture ——
  /**
   * Open a multi-update gesture: push history once. Live commits while open
   * stay local; call `endGesture` to flush autosave.
   */
  beginGesture: () => void;
  /** Close the open gesture and schedule a single autosave if dirty. */
  endGesture: () => void;
  undo: () => void;
  redo: () => void;

  // —— Create (place) ——
  /**
   * Place an edit over the word (or word selection if it includes this word).
   * Keep this generic: kind-specific fields (transition stitch/duration, listicle
   * copy, …) belong on the seed from the caller, not in the store.
   */
  placeEditOnWord: (
    globalIndex: number,
    seed: EditSeed,
    options?: { maxDurationSec?: number | null },
  ) => void;
  /** Place an edit on a caller-computed timeline range (e.g. a transition stitch). */
  placeEditOnRange: (seed: EditSeed, range: TimelineTime) => void;
  /** Replace one companion-SFX cue (settings). */
  setCompanionSfxCue: (
    cue: CompanionSfxCueId,
    source: CompanionSfxSource,
  ) => void;
  /** Merge newly uploaded assets into the editor library. */
  addAssets: (assets: EditorAsset[]) => void;
  setMusic: (assetId: string) => void;
  /**
   * Move an A-roll asset run from `fromIndex` → `toIndex` (stitch order).
   * Edits starting in a run move with it. `Asset.sortOrder` syncs on config save.
   * Pass `live: true` during drag (pair with `beginGesture` / `endGesture`).
   */
  reorderArollAssets: (
    fromIndex: number,
    toIndex: number,
    live?: boolean,
  ) => void;

  // —— Read (get) ——
  getGlobalWords: () => GlobalTranscriptWord[];
  getDurationSec: () => number;
  getLayout: () => ArollLayoutCell[];

  // —— Update (patches) ——
  /** Live edge drag — domain owns move vs trim for duration-limited media. */
  patchEditRange: (id: number, edge: RangeEdge, value: number) => void;
  /** Live keep-edge patch; `arollIndex` is index in `config.arolls`. */
  patchArollRange: (
    arollIndex: number,
    edge: "start" | "end",
    targetTimelineSec: number,
  ) => void;
  /** Patch Project field `captions` TemplateStyle. */
  patchCaptions: (patch: Partial<TemplateStyle>, live?: boolean) => void;
  /** Patch Project field `listicleStyle` and fan out onto every listicle edit. */
  patchListicleStyle: (patch: Partial<TemplateStyle>, live?: boolean) => void;
  /** Replace Project field `emphasisStyle`. */
  patchEmphasisStyle: (next: EmphasisStyle, live?: boolean) => void;
  /** Patch fields on an existing edit (discriminant fixed). */
  patchEdit: (id: number, patch: EditPatch, live?: boolean) => void;
  /** Volume / media offset for the music bed or an sfx/b-roll edit. */
  patchMediaRef: (
    target: "music" | EditId,
    patch: MediaRefPatch,
    live?: boolean,
  ) => void;
  /** Patch a projected word (writes through to the asset transcript). */
  patchWord: (globalIndex: number, patch: WordPatch, live?: boolean) => void;
  /** Rename Project.title column only (does not sync text VFX). */
  setProjectTitle: (title: string) => void;

  // —— Delete ——
  deleteSelection: () => boolean;
  clearMusic: () => void;
  /** Cut the word (or word selection if it includes this word). */
  cutWord: (globalIndex: number) => void;

  /**
   * Local UI clear before editor AI re-run: keep b-roll, drop other edits +
   * emphasis. Does not mark dirty / autosave — server rewrite is the source of truth.
   */
  clearForAiAssist: () => void;
};

let history: Snapshot[] = [];
let future: Snapshot[] = [];
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let scrubbing = false;
/** True between beginGesture / endGesture — live commits skip autosave. */
let gestureActive = false;
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

function sizeMap(
  assets: EditorAsset[],
): Map<string, { width: number; height: number }> {
  const map = new Map<string, { width: number; height: number }>();
  for (const a of assets) {
    if (a.width != null && a.height != null && a.width > 0 && a.height > 0) {
      map.set(a.id, { width: a.width, height: a.height });
    }
  }
  return map;
}

function kindMap(
  assets: EditorAsset[],
): Map<string, "video" | "image" | "audio"> {
  return new Map(assets.map((a) => [a.id, a.kind]));
}

function loudnessMap(
  assets: EditorAsset[],
): Map<string, { lufs: number | null; truePeakDb: number | null }> {
  return new Map(
    assets.map((a) => [a.id, { lufs: a.lufs, truePeakDb: a.truePeakDb }]),
  );
}

function recomputeProps(state: {
  config: ProjectConfig;
  assets: EditorAsset[];
  transcriptsByAssetId: Record<string, TranscriptWord[]>;
  fps: number;
  title?: string;
}): ProjectProps {
  return buildProjectProps({
    config: state.config,
    title: state.title,
    mediaUrls: mediaUrlMap(state.assets),
    transcriptsByAssetId: transcriptMap(state.transcriptsByAssetId),
    assetDurationSec: durationMapFromAssets(state.assets),
    assetSize: sizeMap(state.assets),
    assetKind: kindMap(state.assets),
    assetLoudness: loudnessMap(state.assets),
    fps: state.fps,
  });
}

type LayoutCache = {
  config: ProjectConfig;
  assets: EditorAsset[];
  value: ArollLayoutCell[];
};

type WordsCache = {
  config: ProjectConfig;
  assets: EditorAsset[];
  transcriptsByAssetId: Record<string, TranscriptWord[]>;
  value: GlobalTranscriptWord[];
};

let layoutCache: LayoutCache | null = null;
let wordsCache: WordsCache | null = null;

function layoutFor(
  config: ProjectConfig,
  assets: EditorAsset[],
): ArollLayoutCell[] {
  if (layoutCache?.config === config && layoutCache.assets === assets) {
    return layoutCache.value;
  }
  const value = buildArollLayoutFromAssets(config.arolls, assets);
  layoutCache = { config, assets, value };
  return value;
}

function globalWordsFor(
  config: ProjectConfig,
  transcriptsByAssetId: Record<string, TranscriptWord[]>,
  assets: EditorAsset[],
): GlobalTranscriptWord[] {
  if (
    wordsCache?.config === config &&
    wordsCache.transcriptsByAssetId === transcriptsByAssetId &&
    wordsCache.assets === assets
  ) {
    return wordsCache.value;
  }
  const value = projectTimelineWords(
    config.arolls,
    transcriptMap(transcriptsByAssetId),
    durationMapFromAssets(assets),
  );
  wordsCache = { config, transcriptsByAssetId, assets, value };
  return value;
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
    const live = options?.live === true;
    const prev = snapshot();
    // Gesture already snapshot history at beginGesture.
    if (!live && !gestureActive && prev) pushHistory(prev);

    const state = get();
    const configDirty = next.config !== lastSavedConfig;
    const transcriptsDirty = next.transcriptsByAssetId !== lastSavedTranscripts;
    const props = recomputeProps({
      config: next.config,
      assets: state.assets,
      transcriptsByAssetId: next.transcriptsByAssetId,
      fps: state.fps,
      title: state.title,
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
    // Live updates stay local; endGesture (or a non-live commit) flushes.
    if (!live && (configDirty || transcriptsDirty)) scheduleSave();
  };

  const restore = (snap: Snapshot) => {
    const state = get();
    const configDirty = snap.config !== lastSavedConfig;
    const transcriptsDirty = snap.transcriptsByAssetId !== lastSavedTranscripts;
    const props = recomputeProps({
      config: snap.config,
      assets: state.assets,
      transcriptsByAssetId: snap.transcriptsByAssetId,
      fps: state.fps,
      title: state.title,
    });
    // Same resnap as commit — layout can move under the playhead on undo/redo.
    const layout = layoutFor(snap.config, state.assets);
    const timelineSec = snapTimelineSec(
      layout,
      clampTimelineSec(layout, state.timelineSec),
    );
    const outputSec = timelineToOutputSec(layout, timelineSec);
    set({
      config: snap.config,
      transcriptsByAssetId: snap.transcriptsByAssetId,
      props,
      timelineSec,
      frame: Math.round(outputSec * state.fps),
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
      gestureActive = false;
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
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
        title: data.title?.trim() ? data.title.trim() : "Untitled",
      });
      const layout = layoutFor(data.config, data.assets);
      const timelineSec = snapTimelineSec(layout, 0);
      const outputSec = timelineToOutputSec(layout, timelineSec);
      set({
        loadState: "ready",
        error: null,
        projectId: data.id,
        title: data.title?.trim() ? data.title.trim() : "Untitled",
        status: data.status,
        config: data.config,
        configUpdatedAt: data.configUpdatedAt,
        assets: data.assets,
        transcriptsByAssetId,
        props,
        configDirty: false,
        transcriptsDirty: false,
        saving: false,
        frame: Math.round(outputSec * fps),
        timelineSec,
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
          const prev = lastSavedTranscripts ?? {};
          for (const [assetId, words] of Object.entries(savedTranscripts)) {
            // Immer keeps unchanged word-array identities — skip untouched assets.
            if (prev[assetId] === words) continue;
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
      const timelineSec = outputToTimelineSec(layout, outputSec);
      // Re-write timelineSec even when frame is unchanged — recovers gap/desync.
      if (nextFrame === get().frame && timelineSec === get().timelineSec) return;
      set({ frame: nextFrame, timelineSec });
    },

    seekBySeconds: (delta) => {
      get().seekTimeline(get().timelineSec + delta);
    },

    seekAdjacentWord: (direction) => {
      const { selection, select } = useSelection.getState();
      if (selection?.kind !== "word") return false;
      const words = get().getGlobalWords();
      const focusId = primaryId(selection);
      if (focusId == null) return false;
      const next = adjacentKeptWordIndex(focusId, direction, words);
      if (next == null) return false;
      const word = words[next]!;
      select("word", next);
      get().seekTimeline(word.start);
      return true;
    },

    syncActiveWord: () => {
      const { timelineSec } = get();
      const { selection, select } = useSelection.getState();
      // Keep edit / a-roll selections while scrubbing playhead for preview.
      if (selection != null && selection.kind !== "word") return;
      if (selection?.kind === "word" && selection.ids.length > 1) return;
      const words = get().getGlobalWords();
      const index = wordIndexAtTimelineSec(timelineSec, words);
      if (index == null) return;
      const current =
        selection?.kind === "word" ? (selection.ids[0] ?? null) : null;
      if (index === current) return;
      select("word", index);
    },

    setPxPerSec: (pxPerSec) => set({ pxPerSec }),

    beginGesture: () => {
      if (gestureActive) return;
      gestureActive = true;
      const snap = snapshot();
      if (snap) pushHistory(snap);
    },

    endGesture: () => {
      if (!gestureActive) return;
      gestureActive = false;
      const { configDirty, transcriptsDirty } = get();
      if (configDirty || transcriptsDirty) scheduleSave();
    },

    undo: () => {
      gestureActive = false;
      const current = snapshot();
      const prev = history.pop();
      if (!current || !prev) return;
      future.push(current);
      restore(prev);
    },

    redo: () => {
      gestureActive = false;
      const current = snapshot();
      const next = future.pop();
      if (!current || !next) return;
      history.push(current);
      restore(next);
    },

    deleteSelection: () => {
      const { config, transcriptsByAssetId, assets } = get();
      const { selection, projectPanel, clearSelection, setSelection } =
        useSelection.getState();
      if (!config) return false;

      if (projectPanel === "music" && config.music) {
        commit({
          config: produce(config, (draft) => {
            draft.music = null;
          }),
          transcriptsByAssetId,
        });
        clearSelection();
        return true;
      }

      if (!selection) return false;

      const durations = durationMapFromAssets(assets);

      if (selection.kind === "aroll") {
        if (selection.ids.length === 0) return false;
        const layout = buildArollLayout(config.arolls, durations);
        const cells = selection.ids
          .filter((id): id is number => typeof id === "number")
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
          if (typeof id !== "number") continue;
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
        const range = expandWordDeleteRange(
          { start, end },
          words,
          keepCells(layoutFor(config, assets)).map((c) => c.timeline),
        );
        commit({
          config: deleteTimelineRange(config, range, durations),
          transcriptsByAssetId,
        });
        clearSelection();
        setSelection(null);
        return true;
      }

      return false;
    },

    clearMusic: () => {
      const { config, transcriptsByAssetId } = get();
      if (!config || !config.music) return;
      const next = produce(config, (draft) => {
        draft.music = null;
      });
      commit({ config: next, transcriptsByAssetId });
      useSelection.getState().clearSelection();
    },

    patchWord: (globalIndex, patch, live = false) => {
      const { config, transcriptsByAssetId, assets } = get();
      if (!config) return;
      const words = projectTimelineWords(
        config.arolls,
        transcriptMap(transcriptsByAssetId),
        durationMapFromAssets(assets),
      );
      const word = words[globalIndex];
      if (!word) return;

      commit(
        {
          config,
          transcriptsByAssetId: produce(transcriptsByAssetId, (draft) => {
            const local = draft[word.assetId]?.[word.localIndex];
            if (!local) return;
            if ("text" in patch && patch.text != null) {
              local.text = patch.text;
            }
            if ("emphasized" in patch) {
              local.emphasized = patch.emphasized ? true : undefined;
            }
          }),
        },
        { live },
      );
    },

    placeEditOnRange: (seed, range) => {
      const { config, transcriptsByAssetId, assets } = get();
      if (!config) return;
      const timelineDuration = layoutTimelineDuration(layoutFor(config, assets));
      const result = placeEdit(config, range, timelineDuration, seed, {
        srcDurationSec: (assetId) =>
          assets.find((a) => a.id === assetId)?.durationSec ?? null,
        sfxAssets: assets
          .filter((a) => a.audioLibrary === "sfx")
          .map((a) => ({
            id: a.id,
            originalFilename: a.originalFilename,
          })),
      });
      if (!result) return;
      commit({ config: result.config, transcriptsByAssetId });
      useSelection.getState().select("edit", result.placed.id);
    },

    placeEditOnWord: (globalIndex, seed, options) => {
      const { config, assets } = get();
      if (!config) return;
      const words = get().getGlobalWords();
      const word = words[globalIndex];
      if (!word) return;
      const { selection } = useSelection.getState();
      const layout = layoutFor(config, assets);
      const keepRanges = layout
        .filter((c) => c.kind === "keep")
        .map((c) => c.timeline);
      let range = snapWordActionRangeToKeeps(
        wordActionRange(selection, word, words),
        words,
        keepRanges,
      );
      if (options?.maxDurationSec != null) {
        range = clampTimelineRangeToMedia(range, options.maxDurationSec);
      }
      get().placeEditOnRange(seed, range);
    },

    setCompanionSfxCue: (cue, source) => {
      const { config, transcriptsByAssetId } = get();
      if (!config) return;
      const current = config.companionSfx[cue];
      if (JSON.stringify(current) === JSON.stringify(source)) return;
      const next = produce(config, (draft) => {
        draft.companionSfx[cue] = source;
      });
      commit({ config: next, transcriptsByAssetId });
    },

    addAssets: (incoming) => {
      const { assets, config, transcriptsByAssetId, fps } = get();
      if (!config) return;
      const byId = new Map(assets.map((a) => [a.id, a]));
      for (const a of incoming) byId.set(a.id, a);
      const nextAssets = [...byId.values()].sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );
      set({
        assets: nextAssets,
        props: recomputeProps({
          config,
          assets: nextAssets,
          transcriptsByAssetId,
          fps,
          title: get().title,
        }),
      });
    },

    setMusic: (assetId) => {
      const { config, transcriptsByAssetId } = get();
      if (!config) return;
      const next = produce(config, (draft) => {
        draft.music = musicFromAsset(assetId);
      });
      commit({ config: next, transcriptsByAssetId });
      useSelection.getState().openMusicPanel();
    },

    reorderArollAssets: (fromIndex, toIndex, live = false) => {
      const { config, transcriptsByAssetId, assets } = get();
      if (!config || fromIndex === toIndex) return;
      const nextConfig = reorderArollAssets(
        config,
        fromIndex,
        toIndex,
        durationMapFromAssets(assets),
      );
      if (nextConfig === config) return;
      commit({ config: nextConfig, transcriptsByAssetId }, { live });
    },

    cutWord: (globalIndex) => {
      const { config, transcriptsByAssetId, assets } = get();
      if (!config) return;
      const words = get().getGlobalWords();
      const word = words[globalIndex];
      if (!word) return;
      const { selection, clearSelection } = useSelection.getState();
      const range = wordDeleteRange(
        selection,
        word,
        words,
        keepCells(get().getLayout()).map((c) => c.timeline),
      );
      commit({
        config: deleteTimelineRange(config, range, durationMapFromAssets(assets)),
        transcriptsByAssetId,
      });
      clearSelection();
    },

    clearForAiAssist: () => {
      const state = get();
      if (!state.config) return;

      const nextConfig: ProjectConfig = {
        ...state.config,
        edits: state.config.edits.filter((e) => e.kind === "broll"),
      };
      const nextTranscripts = produce(state.transcriptsByAssetId, (draft) => {
        for (const words of Object.values(draft)) {
          for (const w of words) {
            delete w.emphasized;
          }
        }
      });
      const props = recomputeProps({
        config: nextConfig,
        assets: state.assets,
        transcriptsByAssetId: nextTranscripts,
        fps: state.fps,
        title: state.title,
      });

      set({
        config: nextConfig,
        transcriptsByAssetId: nextTranscripts,
        props,
      });

      const { selection, clearSelection } = useSelection.getState();
      if (selection?.kind === "edit") {
        const kept = new Set(nextConfig.edits.map((e) => e.id));
        if (
          selection.ids.some((id) => typeof id !== "number" || !kept.has(id))
        ) {
          clearSelection();
        }
      }
    },

    patchEditRange: (id, edge, value) => {
      const { config, transcriptsByAssetId, assets } = get();
      if (!config) return;
      const duration = layoutTimelineDuration(layoutFor(config, assets));
      const next = applyPatchEditRange(config, id, edge, value, duration, {
        srcDurationSec: (assetId) =>
          assets.find((a) => a.id === assetId)?.durationSec ?? null,
      });
      if (next === config) return;
      commit({ config: next, transcriptsByAssetId }, { live: true });
    },

    patchArollRange: (arollIndex, edge, targetTimelineSec) => {
      const { config, transcriptsByAssetId, assets } = get();
      if (!config) return;
      const durations = durationMapFromAssets(assets);
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

    patchCaptions: (patch, live = false) => {
      const { config, transcriptsByAssetId } = get();
      if (!config) return;
      const next = produce(config, (draft) => {
        const templateId = patch.templateId ?? draft.captions.templateId;
        const overrides = patch.overrides ?? draft.captions.overrides;
        draft.captions = {
          templateId,
          ...(overrides && Object.keys(overrides).length > 0
            ? { overrides }
            : {}),
        };
      });
      commit({ config: next, transcriptsByAssetId }, { live });
    },

    patchListicleStyle: (patch, live = false) => {
      const { config, transcriptsByAssetId } = get();
      if (!config) return;
      const next = produce(config, (draft) => {
        draft.listicleStyle = applyTemplateStylePatch(
          draft.listicleStyle,
          patch,
        );
        // Denormalize onto every listicle so resolve paths only need the edit.
        for (const edit of draft.edits) {
          if (isListicleEdit(edit)) {
            edit.style = cloneTemplateStyle(draft.listicleStyle);
          }
        }
      });
      commit({ config: next, transcriptsByAssetId }, { live });
    },

    patchEmphasisStyle: (nextStyle, live = false) => {
      const { config, transcriptsByAssetId } = get();
      if (!config) return;
      const next = produce(config, (draft) => {
        draft.emphasisStyle = nextStyle;
      });
      commit({ config: next, transcriptsByAssetId }, { live });
    },

    patchEdit: (id, patch, live = false) => {
      const { config, transcriptsByAssetId, assets } = get();
      if (!config) return;
      commit(
        {
          config: applyPatchEdit(config, id, patch, {
            srcDurationSec: (assetId) =>
              assets.find((a) => a.id === assetId)?.durationSec ?? null,
          }),
          transcriptsByAssetId,
        },
        { live },
      );
    },

    patchMediaRef: (target, patch, live = false) => {
      if (target !== "music") {
        get().patchEdit(target, patch, live);
        return;
      }
      const { config, transcriptsByAssetId, assets } = get();
      if (!config?.music) return;
      const srcDur =
        assets.find((a) => a.id === config.music!.assetId)?.durationSec ??
        null;
      const next = produce(config, (draft) => {
        draft.music = withMediaRefPatch(
          draft.music!,
          patch,
          srcDur,
          MUSIC_VOLUME_DEFAULT,
        );
      });
      commit({ config: next, transcriptsByAssetId }, { live });
    },

    setProjectTitle: (title) => {
      set({ title: title.trim() || "Untitled" });
    },

    getGlobalWords: () => {
      const { config, transcriptsByAssetId, assets } = get();
      if (!config) return [];
      return globalWordsFor(config, transcriptsByAssetId, assets);
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
  // Word projection depends on arolls + transcripts, not edits. Selecting
  // `arolls` (immer-shared) skips re-renders on cosmetic edit patches.
  const arolls = useEditor((s) => s.config?.arolls);
  const transcriptsByAssetId = useEditor((s) => s.transcriptsByAssetId);
  const assets = useEditor((s) => s.assets);
  const config = useEditor.getState().config;
  if (!config || arolls == null) return [];
  return globalWordsFor(config, transcriptsByAssetId, assets);
}

/** Like `useEditor`, with a custom equality fn (zustand v5). */
export function useEditorEqual<T>(
  selector: (state: EditorState & EditorActions) => T,
  equalityFn: (a: T, b: T) => boolean,
): T {
  return useStoreWithEqualityFn(useEditor, selector, equalityFn);
}

export const EDITOR_COMPOSITION = {
  width: COMPOSITION_WIDTH,
  height: COMPOSITION_HEIGHT,
  fps: COMPOSITION_FPS,
} as const;
