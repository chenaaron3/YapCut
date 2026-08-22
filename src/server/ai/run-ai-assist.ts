import { buildArollLayout } from "~/domain/aroll/arolls";
import {
  firstKeepTimelineSec,
  layoutTimelineDuration,
} from "~/domain/aroll/layout-time";
import { overlayTemplateStyle } from "~/domain/project/project-config";
import { keptTimelineWords, projectTimelineWords } from "~/domain/aroll/projection";
import { snapWordBoundsToKeepEdges } from "~/domain/edit/snap";
import { seedTitleTextVfx } from "~/domain/edit/vfx";
import { generateCompanionSfxEdits } from "~/server/ai/companion-sfx";
import { generateEmphasisUpdates } from "~/server/ai/emphasis";
import { generateEmphasisSfxEdits } from "~/server/ai/emphasis-sfx";
import { generateListicleEdits } from "~/server/ai/listicles";
import { generatePacingReconcileZooms } from "~/server/ai/pacing-reconcile";
import { generateQuoteEdits } from "~/server/ai/quotes";
import { generateSpeechCleanupArolls } from "~/server/ai/speech-cleanup";
import { generateTitle } from "~/server/ai/title";
import { generateTransitionEdits } from "~/server/ai/transitions";
import { generateZoomEdits } from "~/server/ai/zooms";

import type { CompanionSfxMap } from "~/domain/audio/companion-sfx-map";
import type {
  ArollKeep,
  Edit,
  OverlayTemplateStyle,
} from "~/domain/project/project-config";
import type { TranscriptWord } from "~/domain/transcript/transcript";

export type AiAssistProgress = (
  completed: number,
  total: number,
  label: string,
) => void | Promise<void>;

/**
 * JSON-serializable AI assist state (Workflow steps + in-process).
 * Use {@link createAiAssistState} to bootstrap; pass `onProgress` separately.
 */
export type AiAssistState = {
  arolls: ArollKeep[];
  wordsByAssetId: Record<string, TranscriptWord[]>;
  durationByAssetId: Record<string, number>;
  title: string;
  edits: Edit[];
  /** Resolved: generate a title this run (empty title + caller asked). */
  generateTitleIfEmpty: boolean;
  trimSpeech: boolean;
  listicleStyle: OverlayTemplateStyle;
  companionSfx?: CompanionSfxMap;
  /** Edit ids present before AI — companion SFX skips these. */
  baseEditIds: number[];
  completed: number;
  total: number;
};

function wordsMap(
  record: Record<string, TranscriptWord[]>,
): Map<string, TranscriptWord[]> {
  return new Map(Object.entries(record));
}

function durationMap(
  record: Record<string, number>,
): Map<string, number> {
  return new Map(Object.entries(record));
}

function clearEmphasis(
  wordsByAssetId: Record<string, TranscriptWord[]>,
): Record<string, TranscriptWord[]> {
  const out: Record<string, TranscriptWord[]> = {};
  for (const [assetId, words] of Object.entries(wordsByAssetId)) {
    out[assetId] = words.map((w) => ({
      text: w.text,
      start: w.start,
      end: w.end,
    }));
  }
  return out;
}

function projectAssistWords(
  arolls: ArollKeep[],
  wordsByAssetId: Map<string, TranscriptWord[]>,
  durationByAssetId: Map<string, number>,
) {
  const layout = buildArollLayout(arolls, durationByAssetId);
  const keepRanges = layout
    .filter((c) => c.kind === "keep")
    .map((c) => c.timeline);
  const timelineWords = snapWordBoundsToKeepEdges(
    keptTimelineWords(
      projectTimelineWords(arolls, wordsByAssetId, durationByAssetId),
    ),
    keepRanges,
  );
  return {
    layout,
    keepRanges,
    timelineWords,
    timelineDuration: layoutTimelineDuration(layout),
    titleStartSec: firstKeepTimelineSec(layout),
  };
}

/** Bootstrap progress counters, clear emphasis, snapshot base edit ids. */
export function createAiAssistState(
  init: Omit<
    AiAssistState,
    | "completed"
    | "total"
    | "baseEditIds"
    | "generateTitleIfEmpty"
    | "trimSpeech"
    | "listicleStyle"
    | "edits"
  > & {
    edits?: Edit[];
    generateTitleIfEmpty?: boolean;
    trimSpeech?: boolean;
    listicleStyle?: OverlayTemplateStyle;
  },
): AiAssistState {
  const title = init.title.trim();
  const generateTitleIfEmpty = !title && Boolean(init.generateTitleIfEmpty);
  const trimSpeech = Boolean(init.trimSpeech);
  const edits = [...(init.edits ?? [])];
  return {
    arolls: init.arolls,
    wordsByAssetId: clearEmphasis(init.wordsByAssetId),
    durationByAssetId: init.durationByAssetId,
    title,
    edits,
    generateTitleIfEmpty,
    trimSpeech,
    listicleStyle: init.listicleStyle ?? overlayTemplateStyle(),
    companionSfx: init.companionSfx,
    baseEditIds: edits.map((e) => e.id),
    completed: 0,
    total: (trimSpeech ? 1 : 0) + (generateTitleIfEmpty ? 1 : 0) + 8,
  };
}

async function tickProgress(
  state: AiAssistState,
  label: string,
  onProgress?: AiAssistProgress,
): Promise<void> {
  await onProgress?.(state.completed, state.total, label);
}

function markDone(state: AiAssistState): AiAssistState {
  return { ...state, completed: state.completed + 1 };
}

async function doneProgress(
  state: AiAssistState,
  label: string,
  onProgress?: AiAssistProgress,
): Promise<AiAssistState> {
  const next = markDone(state);
  await onProgress?.(next.completed, next.total, label);
  return next;
}

export async function aiAssistSpeechCleanup(
  state: AiAssistState,
  onProgress?: AiAssistProgress,
): Promise<AiAssistState> {
  if (!state.trimSpeech) return state;
  const label = "Cutting fillers…";
  await tickProgress(state, label, onProgress);
  let arolls = state.arolls;
  try {
    arolls = await generateSpeechCleanupArolls({
      arolls: state.arolls,
      wordsByAssetId: wordsMap(state.wordsByAssetId),
      durationByAssetId: durationMap(state.durationByAssetId),
    });
  } catch (error) {
    console.warn(
      "[ai-assist] speech cleanup soft-failed:",
      error instanceof Error ? error.message : error,
    );
  }
  return doneProgress({ ...state, arolls }, label, onProgress);
}

/** Generate title when requested, then seed title text VFX if title is set. */
export async function aiAssistTitle(
  state: AiAssistState,
  onProgress?: AiAssistProgress,
): Promise<AiAssistState> {
  const wordsByAssetId = wordsMap(state.wordsByAssetId);
  const durationByAssetId = durationMap(state.durationByAssetId);
  const { timelineWords, timelineDuration, titleStartSec } = projectAssistWords(
    state.arolls,
    wordsByAssetId,
    durationByAssetId,
  );

  let title = state.title;
  let next = state;

  if (state.generateTitleIfEmpty) {
    const label = "Writing title…";
    await tickProgress(next, label, onProgress);
    try {
      title = await generateTitle(timelineWords);
      console.log(`[ai-assist] title="${title}"`);
    } catch (error) {
      console.warn(
        "[ai-assist] title soft-failed:",
        error instanceof Error ? error.message : error,
      );
    }
    next = await doneProgress({ ...next, title }, label, onProgress);
  }

  let edits = next.edits;
  if (title) {
    edits = [
      ...edits,
      seedTitleTextVfx({
        edits,
        title,
        startSec: titleStartSec,
        timelineDurationSec: timelineDuration,
      }),
    ];
  }
  return { ...next, title, edits };
}

export async function aiAssistZooms(
  state: AiAssistState,
  onProgress?: AiAssistProgress,
): Promise<AiAssistState> {
  const label = "Finding punch-ins…";
  await tickProgress(state, label, onProgress);
  const { timelineWords } = projectAssistWords(
    state.arolls,
    wordsMap(state.wordsByAssetId),
    durationMap(state.durationByAssetId),
  );
  let edits = state.edits;
  try {
    const zooms = await generateZoomEdits(timelineWords, edits);
    edits = [...edits, ...zooms];
    console.log(`[ai-assist] zooms=${zooms.length}`);
  } catch (error) {
    console.warn(
      "[ai-assist] zoom soft-failed:",
      error instanceof Error ? error.message : error,
    );
  }
  return doneProgress({ ...state, edits }, label, onProgress);
}

export async function aiAssistListicles(
  state: AiAssistState,
  onProgress?: AiAssistProgress,
): Promise<AiAssistState> {
  const label = "Finding listicles…";
  await tickProgress(state, label, onProgress);
  const { timelineWords } = projectAssistWords(
    state.arolls,
    wordsMap(state.wordsByAssetId),
    durationMap(state.durationByAssetId),
  );
  let edits = state.edits;
  try {
    const listicles = await generateListicleEdits(
      timelineWords,
      edits,
      state.listicleStyle,
    );
    edits = [...edits, ...listicles];
    console.log(`[ai-assist] listicles=${listicles.length}`);
  } catch (error) {
    console.warn(
      "[ai-assist] listicle soft-failed:",
      error instanceof Error ? error.message : error,
    );
  }
  return doneProgress({ ...state, edits }, label, onProgress);
}

export async function aiAssistTransitions(
  state: AiAssistState,
  onProgress?: AiAssistProgress,
): Promise<AiAssistState> {
  const label = "Placing transitions…";
  await tickProgress(state, label, onProgress);
  const { layout, timelineWords } = projectAssistWords(
    state.arolls,
    wordsMap(state.wordsByAssetId),
    durationMap(state.durationByAssetId),
  );
  let edits = state.edits;
  try {
    edits = await generateTransitionEdits(timelineWords, edits, layout);
    console.log(
      `[ai-assist] transitions=${edits.filter((e) => e.kind === "transition").length}`,
    );
  } catch (error) {
    console.warn(
      "[ai-assist] transition soft-failed:",
      error instanceof Error ? error.message : error,
    );
  }
  return doneProgress({ ...state, edits }, label, onProgress);
}

export async function aiAssistQuotes(
  state: AiAssistState,
  onProgress?: AiAssistProgress,
): Promise<AiAssistState> {
  const label = "Finding quotes…";
  await tickProgress(state, label, onProgress);
  const { timelineWords } = projectAssistWords(
    state.arolls,
    wordsMap(state.wordsByAssetId),
    durationMap(state.durationByAssetId),
  );
  let edits = state.edits;
  try {
    const quotes = await generateQuoteEdits(timelineWords, edits);
    edits = [...edits, ...quotes];
    console.log(`[ai-assist] quotes=${quotes.length}`);
  } catch (error) {
    console.warn(
      "[ai-assist] quote soft-failed:",
      error instanceof Error ? error.message : error,
    );
  }
  return doneProgress({ ...state, edits }, label, onProgress);
}

export async function aiAssistEmphasis(
  state: AiAssistState,
  onProgress?: AiAssistProgress,
): Promise<AiAssistState> {
  const label = "Marking emphasis…";
  await tickProgress(state, label, onProgress);
  const wordsByAssetId = wordsMap(state.wordsByAssetId);
  const { timelineWords } = projectAssistWords(
    state.arolls,
    wordsByAssetId,
    durationMap(state.durationByAssetId),
  );
  try {
    const updates = await generateEmphasisUpdates(
      timelineWords,
      wordsByAssetId,
      state.edits,
    );
    for (const [assetId, words] of updates) {
      wordsByAssetId.set(assetId, words);
    }
    console.log(`[ai-assist] emphasis updated assets=${updates.size}`);
  } catch (error) {
    console.warn(
      "[ai-assist] emphasis soft-failed:",
      error instanceof Error ? error.message : error,
    );
  }
  return doneProgress(
    { ...state, wordsByAssetId: Object.fromEntries(wordsByAssetId) },
    label,
    onProgress,
  );
}

export async function aiAssistPacing(
  state: AiAssistState,
  onProgress?: AiAssistProgress,
): Promise<AiAssistState> {
  const label = "Adding slow zooms…";
  await tickProgress(state, label, onProgress);
  const wordsByAssetId = wordsMap(state.wordsByAssetId);
  const durationByAssetId = durationMap(state.durationByAssetId);
  const { keepRanges } = projectAssistWords(
    state.arolls,
    wordsByAssetId,
    durationByAssetId,
  );
  const timelineWordsAfterEmphasis = snapWordBoundsToKeepEdges(
    keptTimelineWords(
      projectTimelineWords(state.arolls, wordsByAssetId, durationByAssetId),
    ),
    keepRanges,
  );
  let edits = state.edits;
  try {
    const slowZooms = await generatePacingReconcileZooms(
      timelineWordsAfterEmphasis,
      edits,
    );
    edits = [...edits, ...slowZooms];
    console.log(`[ai-assist] pacing slowZooms=${slowZooms.length}`);
  } catch (error) {
    console.warn(
      "[ai-assist] pacing soft-failed:",
      error instanceof Error ? error.message : error,
    );
  }
  return doneProgress({ ...state, edits }, label, onProgress);
}

export async function aiAssistCompanionSfx(
  state: AiAssistState,
  onProgress?: AiAssistProgress,
): Promise<AiAssistState> {
  const label = "Placing companion SFX…";
  await tickProgress(state, label, onProgress);
  let edits = state.edits;
  try {
    edits = await generateCompanionSfxEdits({
      edits,
      companionSfx: state.companionSfx,
      skipIds: new Set(state.baseEditIds),
    });
  } catch (error) {
    console.warn(
      "[ai-assist] companion SFX soft-failed:",
      error instanceof Error ? error.message : error,
    );
  }
  return doneProgress({ ...state, edits }, label, onProgress);
}

export async function aiAssistEmphasisSfx(
  state: AiAssistState,
  onProgress?: AiAssistProgress,
): Promise<AiAssistState> {
  const label = "Placing emphasis SFX…";
  await tickProgress(state, label, onProgress);
  const wordsByAssetId = wordsMap(state.wordsByAssetId);
  const durationByAssetId = durationMap(state.durationByAssetId);
  const { keepRanges } = projectAssistWords(
    state.arolls,
    wordsByAssetId,
    durationByAssetId,
  );
  const timelineWordsAfterEmphasis = snapWordBoundsToKeepEdges(
    keptTimelineWords(
      projectTimelineWords(state.arolls, wordsByAssetId, durationByAssetId),
    ),
    keepRanges,
  );
  let edits = state.edits;
  try {
    const sfxEdits = await generateEmphasisSfxEdits({
      words: timelineWordsAfterEmphasis,
      edits,
    });
    edits = [...edits, ...sfxEdits];
    console.log(`[ai-assist] emphasisSfx=${sfxEdits.length}`);
  } catch (error) {
    console.warn(
      "[ai-assist] emphasis SFX soft-failed:",
      error instanceof Error ? error.message : error,
    );
  }
  return doneProgress({ ...state, edits }, label, onProgress);
}

/**
 * Shared create / editor AI assist: optional speech cleanup (create) →
 * punch-ins → listicles → transitions → quotes → emphasis → pacing slow
 * zooms → companion SFX → emphasis pings.
 */
export async function runAiAssist(
  state: AiAssistState,
  onProgress?: AiAssistProgress,
): Promise<AiAssistState> {
  let next = state;
  next = await aiAssistSpeechCleanup(next, onProgress);
  next = await aiAssistTitle(next, onProgress);
  next = await aiAssistZooms(next, onProgress);
  next = await aiAssistListicles(next, onProgress);
  next = await aiAssistTransitions(next, onProgress);
  next = await aiAssistQuotes(next, onProgress);
  next = await aiAssistEmphasis(next, onProgress);
  next = await aiAssistPacing(next, onProgress);
  next = await aiAssistCompanionSfx(next, onProgress);
  next = await aiAssistEmphasisSfx(next, onProgress);
  return next;
}
