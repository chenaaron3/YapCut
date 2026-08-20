import { buildArollLayout } from "~/domain/aroll/arolls";
import {
  firstKeepTimelineSec,
  layoutTimelineDuration,
} from "~/domain/aroll/layout-time";
import { DEFAULT_LISTICLE_TEMPLATE_ID } from "~/domain/project/project-config";
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
import type { ArollKeep, Edit, TemplateStyle } from "~/domain/project/project-config";
import type { TranscriptWord } from "~/domain/transcript/transcript";

export type AiAssistProgress = (
  completed: number,
  total: number,
  label: string,
) => void | Promise<void>;

export type AiAssistInput = {
  arolls: ArollKeep[];
  wordsByAssetId: Map<string, TranscriptWord[]>;
  durationByAssetId: Map<string, number>;
  /** Existing project title (may be empty). */
  title: string;
  /** When true and title empty, generate a title. */
  generateTitleIfEmpty: boolean;
  /** Edits to keep before AI (`editsForAiAssist`). */
  baseEdits?: readonly Edit[];
  /** SoT listicle look — copied onto each seeded listicle. */
  listicleStyle?: TemplateStyle;
  /** Companion cue map (create uses shipped defaults). */
  companionSfx?: CompanionSfxMap;
  /** Create only: cut vocalized pauses + retakes before visual AI. */
  trimSpeech?: boolean;
  onProgress?: AiAssistProgress;
};

export type AiAssistResult = {
  title: string;
  edits: Edit[];
  /** Per-asset words with emphasis applied (only changed assets may differ). */
  wordsByAssetId: Map<string, TranscriptWord[]>;
  arolls: ArollKeep[];
};

function clearEmphasis(
  wordsByAssetId: Map<string, TranscriptWord[]>,
): Map<string, TranscriptWord[]> {
  const out = new Map<string, TranscriptWord[]>();
  for (const [assetId, words] of wordsByAssetId) {
    out.set(
      assetId,
      words.map((w) => ({
        text: w.text,
        start: w.start,
        end: w.end,
      })),
    );
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

/**
 * Shared create / editor AI assist: optional speech cleanup (create) →
 * punch-ins → listicles → transitions → quotes → emphasis → pacing slow
 * zooms → companion SFX → emphasis pings.
 */
export async function runAiAssist(
  input: AiAssistInput,
): Promise<AiAssistResult> {
  const wordsByAssetId = clearEmphasis(input.wordsByAssetId);
  const { durationByAssetId, onProgress } = input;
  let arolls = input.arolls;
  const includeTitle = !input.title.trim() && input.generateTitleIfEmpty;
  const includeTrim = Boolean(input.trimSpeech);
  const total = (includeTrim ? 1 : 0) + (includeTitle ? 1 : 0) + 8;
  let completed = 0;
  const tick = async (label: string) => {
    await onProgress?.(completed, total, label);
  };
  const done = async (label: string) => {
    completed += 1;
    await onProgress?.(completed, total, label);
  };

  if (includeTrim) {
    await tick("Cutting fillers…");
    try {
      arolls = await generateSpeechCleanupArolls({
        arolls,
        wordsByAssetId,
        durationByAssetId,
      });
    } catch (error) {
      console.warn(
        "[ai-assist] speech cleanup soft-failed:",
        error instanceof Error ? error.message : error,
      );
    }
    await done("Cutting fillers…");
  }

  const { layout, keepRanges, timelineWords, timelineDuration, titleStartSec } =
    projectAssistWords(arolls, wordsByAssetId, durationByAssetId);

  let title = input.title.trim();
  let edits: Edit[] = [...(input.baseEdits ?? [])];

  if (includeTitle) {
    await tick("Writing title…");
    try {
      title = await generateTitle(timelineWords);
      console.log(`[ai-assist] title="${title}"`);
    } catch (error) {
      console.warn(
        "[ai-assist] title soft-failed:",
        error instanceof Error ? error.message : error,
      );
    }
    await done("Writing title…");
  }

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

  await tick("Finding punch-ins…");
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
  await done("Finding punch-ins…");

  await tick("Finding listicles…");
  try {
    const listicles = await generateListicleEdits(
      timelineWords,
      edits,
      input.listicleStyle ?? { templateId: DEFAULT_LISTICLE_TEMPLATE_ID },
    );
    edits = [...edits, ...listicles];
    console.log(`[ai-assist] listicles=${listicles.length}`);
  } catch (error) {
    console.warn(
      "[ai-assist] listicle soft-failed:",
      error instanceof Error ? error.message : error,
    );
  }
  await done("Finding listicles…");

  await tick("Placing transitions…");
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
  await done("Placing transitions…");

  await tick("Finding quotes…");
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
  await done("Finding quotes…");

  await tick("Marking emphasis…");
  try {
    const updates = await generateEmphasisUpdates(
      timelineWords,
      wordsByAssetId,
      edits,
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
  await done("Marking emphasis…");

  const timelineWordsAfterEmphasis = snapWordBoundsToKeepEdges(
    keptTimelineWords(
      projectTimelineWords(arolls, wordsByAssetId, durationByAssetId),
    ),
    keepRanges,
  );

  await tick("Adding slow zooms…");
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
  await done("Adding slow zooms…");

  await tick("Placing companion SFX…");
  try {
    edits = await generateCompanionSfxEdits({
      edits,
      companionSfx: input.companionSfx,
      skipIds: new Set((input.baseEdits ?? []).map((e) => e.id)),
    });
  } catch (error) {
    console.warn(
      "[ai-assist] companion SFX soft-failed:",
      error instanceof Error ? error.message : error,
    );
  }
  await done("Placing companion SFX…");

  await tick("Placing emphasis SFX…");
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
  await done("Placing emphasis SFX…");

  return { title, edits, wordsByAssetId, arolls };
}
