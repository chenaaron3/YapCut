import { inArray } from "drizzle-orm";

import { AI_SFX_PACK } from "~/domain/ai-sfx-pack";
import {
  buildArollLayout,
  firstKeepTimelineSec,
  layoutTimelineDuration,
} from "~/domain/arolls";
import { projectTimelineWords } from "~/domain/projection";
import {
  seedTitleTextVfx,
  type ArollKeep,
  type Edit,
} from "~/domain/project-config";
import type { TranscriptWord } from "~/domain/transcript";
import { generateCompanionSfxEdits } from "~/server/ai/companion-sfx";
import { generateEmphasisUpdates } from "~/server/ai/emphasis";
import { generateListicleEdits } from "~/server/ai/listicles";
import { generatePacingReconcileZooms } from "~/server/ai/pacing-reconcile";
import { generateQuoteEdits } from "~/server/ai/quotes";
import { generateTitle } from "~/server/ai/title";
import { generateZoomEdits } from "~/server/ai/zooms";
import { db } from "~/server/db";
import { assets } from "~/server/db/schema";

export type AiAssistInput = {
  arolls: ArollKeep[];
  wordsByAssetId: Map<string, TranscriptWord[]>;
  durationByAssetId: Map<string, number>;
  /** Existing project title (may be empty). */
  title: string;
  /** When true and title empty, generate a title. */
  generateTitleIfEmpty: boolean;
  /** Edits to keep before AI (typically b-roll only). */
  baseEdits?: readonly Edit[];
};

export type AiAssistResult = {
  title: string;
  edits: Edit[];
  /** Per-asset words with emphasis applied (only changed assets may differ). */
  wordsByAssetId: Map<string, TranscriptWord[]>;
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

async function loadPackSfxDurations(): Promise<Map<string, number | null>> {
  const packAssetIds = [...new Set(AI_SFX_PACK.map((v) => v.assetId))];
  if (packAssetIds.length === 0) return new Map();
  const rows = await db
    .select({
      id: assets.id,
      durationSec: assets.durationSec,
    })
    .from(assets)
    .where(inArray(assets.id, packAssetIds));
  return new Map(rows.map((r) => [r.id, r.durationSec]));
}

/**
 * Shared create / editor AI assist: punch-ins → listicles → quotes →
 * emphasis → pacing slow zooms → companion SFX.
 */
export async function runAiAssist(
  input: AiAssistInput,
): Promise<AiAssistResult> {
  const wordsByAssetId = clearEmphasis(input.wordsByAssetId);
  const { arolls, durationByAssetId } = input;

  const timelineWords = projectTimelineWords(
    arolls,
    wordsByAssetId,
    durationByAssetId,
  );
  const layout = buildArollLayout(arolls, durationByAssetId);
  const timelineDuration = layoutTimelineDuration(layout);
  const titleStartSec = firstKeepTimelineSec(layout);

  let title = input.title.trim();
  let edits: Edit[] = [...(input.baseEdits ?? [])];

  if (!title && input.generateTitleIfEmpty) {
    try {
      title = await generateTitle(timelineWords);
      console.log(`[ai-assist] title="${title}"`);
    } catch (error) {
      console.warn(
        "[ai-assist] title soft-failed:",
        error instanceof Error ? error.message : error,
      );
    }
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

  try {
    const listicles = await generateListicleEdits(timelineWords, edits);
    edits = [...edits, ...listicles];
    console.log(`[ai-assist] listicles=${listicles.length}`);
  } catch (error) {
    console.warn(
      "[ai-assist] listicle soft-failed:",
      error instanceof Error ? error.message : error,
    );
  }

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

  const timelineWordsAfterEmphasis = projectTimelineWords(
    arolls,
    wordsByAssetId,
    durationByAssetId,
  );

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

  try {
    const durationBySfxId = await loadPackSfxDurations();
    const sfxEdits = await generateCompanionSfxEdits(
      timelineWordsAfterEmphasis,
      edits,
      (assetId) => durationBySfxId.get(assetId) ?? null,
    );
    edits = [...edits, ...sfxEdits];
    console.log(`[ai-assist] companionSfx=${sfxEdits.length}`);
  } catch (error) {
    console.warn(
      "[ai-assist] companion SFX soft-failed:",
      error instanceof Error ? error.message : error,
    );
  }

  return { title, edits, wordsByAssetId };
}
