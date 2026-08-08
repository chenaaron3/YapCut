import { asc, eq } from "drizzle-orm";

import {
  buildArollLayout,
  layoutTimelineDuration,
} from "~/domain/arolls";
import { buildArollKeepsFromWords } from "~/domain/keeps";
import { projectTimelineWords } from "~/domain/projection";
import {
  DEFAULT_CAPTION_TEMPLATE_ID,
  emptyProjectConfig,
  seedTitleTextVfx,
  type Edit,
  type ProjectConfig,
} from "~/domain/project-config";
import type { TranscriptWord } from "~/domain/transcript";
import { generateEmphasisUpdates } from "~/server/ai/emphasis";
import { generateTitle } from "~/server/ai/title";
import { generateZoomEdits } from "~/server/ai/zooms";
import { db } from "~/server/db";
import { assets, projects, transcripts } from "~/server/db/schema";
import { headObject, presignGetObject } from "~/server/media/s3";
import { transcribeWithWhisperX } from "~/server/transcribe/whisperx";

const FAILURE_REASON_MAX = 2000;

function truncateReason(reason: string): string {
  if (reason.length <= FAILURE_REASON_MAX) return reason;
  return `${reason.slice(0, FAILURE_REASON_MAX - 1)}…`;
}

async function markFailed(projectId: string, reason: string): Promise<void> {
  console.error(`[create] project ${projectId} failed:`, reason);
  await db
    .update(projects)
    .set({
      status: "failed",
      failureReason: truncateReason(reason),
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId));
}

/**
 * End-to-end create pipeline (Whisper → keeps → AI → ready).
 * Safe to call from Vercel Workflow steps or in-process from createFinalize.
 */
export async function runCreatePipeline(projectId: string): Promise<void> {
  try {
    await runCreatePipelineInner(projectId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Create pipeline failed";
    await markFailed(projectId, message);
  }
}

async function runCreatePipelineInner(projectId: string): Promise<void> {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }
  if (project.status !== "processing") {
    console.warn(
      `[create] skip pipeline: project ${projectId} status=${project.status}`,
    );
    return;
  }

  const projectAssets = await db
    .select()
    .from(assets)
    .where(eq(assets.projectId, projectId))
    .orderBy(asc(assets.sortOrder));

  if (projectAssets.length === 0) {
    throw new Error("No assets found for project");
  }

  // 1. Transcribe each asset (serial — WhisperX is heavy)
  const wordsByAssetId = new Map<string, TranscriptWord[]>();
  const durationByAssetId = new Map<string, number>();

  for (const asset of projectAssets) {
    const head = await headObject(asset.s3Key);
    if (!head) {
      throw new Error(
        `Missing S3 object for asset ${asset.id} (${asset.originalFilename ?? asset.s3Key})`,
      );
    }

    const audioUrl = await presignGetObject({
      key: asset.s3Key,
      expiresInSec: 60 * 60 * 2,
    });

    console.log(
      `[create] whisperx asset=${asset.id} file=${asset.originalFilename ?? "?"}`,
    );

    let result;
    try {
      result = await transcribeWithWhisperX(audioUrl);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "WhisperX failed";
      await db.insert(transcripts).values({
        assetId: asset.id,
        words: [],
        status: "failed",
        raw: { error: message },
      });
      throw new Error(`WhisperX failed for ${asset.originalFilename ?? asset.id}: ${message}`);
    }

    const durationSec =
      result.durationSec ??
      (result.words.length > 0
        ? result.words[result.words.length - 1]!.end
        : null);

    if (durationSec == null || durationSec <= 0) {
      throw new Error(
        `Could not determine duration for ${asset.originalFilename ?? asset.id}`,
      );
    }

    await db
      .update(assets)
      .set({ durationSec, updatedAt: new Date() })
      .where(eq(assets.id, asset.id));

    const existing = await db
      .select({ id: transcripts.id })
      .from(transcripts)
      .where(eq(transcripts.assetId, asset.id))
      .limit(1);

    if (existing[0]) {
      await db
        .update(transcripts)
        .set({
          words: result.words,
          durationSec,
          language: result.language,
          status: "ready",
          raw: result.raw,
          updatedAt: new Date(),
        })
        .where(eq(transcripts.id, existing[0].id));
    } else {
      await db.insert(transcripts).values({
        assetId: asset.id,
        words: result.words,
        durationSec,
        language: result.language,
        status: "ready",
        raw: result.raw,
      });
    }

    wordsByAssetId.set(asset.id, result.words);
    durationByAssetId.set(asset.id, durationSec);
  }

  // 2. Keeps per asset → concat in sortOrder
  const arolls = projectAssets.flatMap((asset) =>
    buildArollKeepsFromWords({
      words: wordsByAssetId.get(asset.id) ?? [],
      durationSec: durationByAssetId.get(asset.id) ?? 0,
      assetId: asset.id,
    }),
  );

  if (arolls.length === 0) {
    throw new Error("Keep builder produced empty arolls");
  }

  // 3. Timeline projection for AI (expanded — gaps count; same axis as Edits)
  const timelineWords = projectTimelineWords(
    arolls,
    wordsByAssetId,
    durationByAssetId,
  );
  const timelineDuration = layoutTimelineDuration(
    buildArollLayout(arolls, durationByAssetId),
  );

  let title = project.title?.trim() ?? "";
  let edits: Edit[] = [];

  // 4. AI title (soft-fail) + seed text VFX when we have a title
  if (!title) {
    try {
      title = await generateTitle(timelineWords);
      console.log(`[create] title="${title}"`);
    } catch (error) {
      console.warn(
        "[create] title AI soft-failed:",
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
        timelineDurationSec: timelineDuration,
      }),
    ];
  }

  // 5. AI zooms (soft-fail)
  try {
    const zooms = await generateZoomEdits(timelineWords, edits);
    edits = [...edits, ...zooms];
    console.log(`[create] zooms=${zooms.length}`);
  } catch (error) {
    console.warn(
      "[create] zoom AI soft-failed:",
      error instanceof Error ? error.message : error,
    );
  }

  // 6. AI emphasis (soft-fail)
  try {
    const updates = await generateEmphasisUpdates(
      timelineWords,
      wordsByAssetId,
    );
    for (const [assetId, words] of updates) {
      wordsByAssetId.set(assetId, words);
      await db
        .update(transcripts)
        .set({ words, updatedAt: new Date() })
        .where(eq(transcripts.assetId, assetId));
    }
    console.log(`[create] emphasis updated assets=${updates.size}`);
  } catch (error) {
    console.warn(
      "[create] emphasis AI soft-failed:",
      error instanceof Error ? error.message : error,
    );
  }

  // 7. Write config → ready
  const config: ProjectConfig = {
    ...emptyProjectConfig(),
    arolls,
    edits,
    captions: { templateId: DEFAULT_CAPTION_TEMPLATE_ID },
  };

  const now = new Date();
  await db
    .update(projects)
    .set({
      title: title.length > 0 ? title : null,
      config,
      configUpdatedAt: now,
      status: "ready",
      failureReason: null,
      updatedAt: now,
    })
    .where(eq(projects.id, projectId));

  console.log(`[create] project ${projectId} → ready`);
}
