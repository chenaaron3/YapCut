import { asc, eq } from "drizzle-orm";

import { buildArollKeepsFromWords } from "~/domain/keeps";
import {
  DEFAULT_CAPTION_TEMPLATE_ID,
  emptyProjectConfig,
  type ProjectConfig,
} from "~/domain/project-config";
import type { TranscriptWord } from "~/domain/transcript";
import { runAiAssist } from "~/server/ai/run-ai-assist";
import { db } from "~/server/db";
import { assets, projects, transcripts } from "~/server/db/schema";
import { headObject, presignGetObject } from "~/server/media/s3";
import {
  getWhisperXPrediction,
  startWhisperXPrediction,
} from "~/server/transcribe/whisperx";

const FAILURE_REASON_MAX = 2000;

export type CreateAssetRef = {
  id: string;
  s3Key: string;
  originalFilename: string | null;
  durationSec: number;
};

function truncateReason(reason: string): string {
  if (reason.length <= FAILURE_REASON_MAX) return reason;
  return `${reason.slice(0, FAILURE_REASON_MAX - 1)}…`;
}

export async function markCreateFailed(
  projectId: string,
  reason: string,
): Promise<void> {
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

/** Load project A-roll assets for create; throws if not processing / empty. */
export async function loadCreateAssets(
  projectId: string,
): Promise<CreateAssetRef[]> {
  const [project] = await db
    .select({ id: projects.id, status: projects.status })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }
  if (project.status !== "processing") {
    throw new Error(
      `Project ${projectId} status=${project.status}, expected processing`,
    );
  }

  const rows = await db
    .select({
      id: assets.id,
      s3Key: assets.s3Key,
      originalFilename: assets.originalFilename,
      durationSec: assets.durationSec,
    })
    .from(assets)
    .where(eq(assets.projectId, projectId))
    .orderBy(asc(assets.sortOrder));

  if (rows.length === 0) {
    throw new Error("No assets found for project");
  }

  return rows.map((row) => {
    if (row.durationSec == null || row.durationSec <= 0) {
      throw new Error(
        `Missing media duration for ${row.originalFilename ?? row.id} (probe before upload)`,
      );
    }
    return {
      id: row.id,
      s3Key: row.s3Key,
      originalFilename: row.originalFilename,
      durationSec: row.durationSec,
    };
  });
}

/**
 * Start (or resume) WhisperX for one asset. Idempotent: reuses prediction id
 * stored on the transcript row when a prior step was terminated mid-flight.
 */
export async function startAssetWhisperX(asset: CreateAssetRef): Promise<{
  predictionId: string;
  alreadyReady: boolean;
}> {
  const [existing] = await db
    .select({
      id: transcripts.id,
      status: transcripts.status,
      raw: transcripts.raw,
    })
    .from(transcripts)
    .where(eq(transcripts.assetId, asset.id))
    .limit(1);

  if (existing?.status === "ready") {
    return { predictionId: "", alreadyReady: true };
  }

  const existingPredictionId =
    existing?.raw &&
    typeof existing.raw === "object" &&
    typeof (existing.raw as { predictionId?: unknown }).predictionId ===
      "string"
      ? (existing.raw as { predictionId: string }).predictionId
      : null;

  if (existingPredictionId) {
    console.log(
      `[create] whisperx resume asset=${asset.id} prediction=${existingPredictionId}`,
    );
    return { predictionId: existingPredictionId, alreadyReady: false };
  }

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

  const { predictionId } = await startWhisperXPrediction(audioUrl);

  const raw = { predictionId };
  if (existing) {
    await db
      .update(transcripts)
      .set({
        status: "pending",
        raw,
        updatedAt: new Date(),
      })
      .where(eq(transcripts.id, existing.id));
  } else {
    await db.insert(transcripts).values({
      assetId: asset.id,
      words: [],
      status: "pending",
      raw,
    });
  }

  console.log(
    `[create] whisperx started asset=${asset.id} prediction=${predictionId}`,
  );
  return { predictionId, alreadyReady: false };
}

/** Persist a succeeded WhisperX prediction onto the asset transcript. */
export async function saveAssetTranscript(
  asset: CreateAssetRef,
  predictionId: string,
): Promise<void> {
  const poll = await getWhisperXPrediction(predictionId);
  if (poll.status !== "succeeded" || !poll.result) {
    throw new Error(
      poll.error ?? `WhisperX not ready (status=${poll.status})`,
    );
  }

  const { words, language, raw } = poll.result;
  const [existing] = await db
    .select({ id: transcripts.id })
    .from(transcripts)
    .where(eq(transcripts.assetId, asset.id))
    .limit(1);

  const payload = {
    words,
    durationSec: asset.durationSec,
    language,
    status: "ready" as const,
    raw: { ...raw, predictionId },
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(transcripts)
      .set(payload)
      .where(eq(transcripts.id, existing.id));
  } else {
    await db.insert(transcripts).values({
      assetId: asset.id,
      ...payload,
    });
  }

  console.log(
    `[create] transcript ready asset=${asset.id} words=${words.length}`,
  );
}

export async function markAssetTranscriptFailed(
  assetId: string,
  reason: string,
): Promise<void> {
  const [existing] = await db
    .select({ id: transcripts.id })
    .from(transcripts)
    .where(eq(transcripts.assetId, assetId))
    .limit(1);

  if (existing) {
    await db
      .update(transcripts)
      .set({
        words: [],
        status: "failed",
        raw: { error: reason },
        updatedAt: new Date(),
      })
      .where(eq(transcripts.id, existing.id));
  } else {
    await db.insert(transcripts).values({
      assetId,
      words: [],
      status: "failed",
      raw: { error: reason },
    });
  }
}

/**
 * After all transcripts are ready: keeps → AI seed → project ready.
 */
export async function finalizeCreateProject(projectId: string): Promise<void> {
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
      `[create] skip finalize: project ${projectId} status=${project.status}`,
    );
    return;
  }

  const projectAssets = await loadCreateAssets(projectId);
  const wordsByAssetId = new Map<string, TranscriptWord[]>();
  const durationByAssetId = new Map<string, number>();

  for (const asset of projectAssets) {
    const [transcript] = await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.assetId, asset.id))
      .limit(1);

    if (!transcript || transcript.status !== "ready") {
      throw new Error(
        `Transcript not ready for ${asset.originalFilename ?? asset.id}`,
      );
    }

    wordsByAssetId.set(asset.id, transcript.words);
    durationByAssetId.set(asset.id, asset.durationSec);
  }

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

  const assist = await runAiAssist({
    arolls,
    wordsByAssetId,
    durationByAssetId,
    title: project.title?.trim() ?? "",
    generateTitleIfEmpty: true,
  });

  for (const [assetId, words] of assist.wordsByAssetId) {
    await db
      .update(transcripts)
      .set({ words, updatedAt: new Date() })
      .where(eq(transcripts.assetId, assetId));
  }

  const config: ProjectConfig = {
    ...emptyProjectConfig(),
    arolls,
    edits: assist.edits,
    captions: { templateId: DEFAULT_CAPTION_TEMPLATE_ID },
  };

  const now = new Date();
  await db
    .update(projects)
    .set({
      title: assist.title.length > 0 ? assist.title : null,
      config,
      configUpdatedAt: now,
      status: "ready",
      failureReason: null,
      updatedAt: now,
    })
    .where(eq(projects.id, projectId));

  console.log(`[create] project ${projectId} → ready`);
}
