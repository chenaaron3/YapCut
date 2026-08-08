/**
 * Vercel Workflow definition for project create.
 * Started when `USE_VERCEL_WORKFLOW=true` (see `startCreatePipeline`).
 *
 * WhisperX runs as a Replicate prediction; we poll across short steps with
 * `sleep()` so a long transcription cannot hit the function maxDuration.
 *
 * @see https://workflow-sdk.dev/docs/getting-started/next
 */
import { FatalError, sleep } from "workflow";

import {
  finalizeCreateProject,
  loadCreateAssets,
  markAssetTranscriptFailed,
  markCreateFailed,
  saveAssetTranscript,
  startAssetWhisperX,
  type CreateAssetRef,
} from "~/server/create/create-pipeline";
import { getWhisperXPrediction } from "~/server/transcribe/whisperx";

/** Suspend between Replicate polls (no compute while sleeping). */
const WHISPERX_POLL_SLEEP = "15s";
/** ~30 minutes of wall time for a single asset transcription. */
const WHISPERX_MAX_POLLS = 120;

export async function createProjectWorkflow(projectId: string) {
  "use workflow";

  try {
    const assets = await loadAssetsStep(projectId);

    for (const asset of assets) {
      const started = await startWhisperXStep(asset);
      if (started.alreadyReady) continue;

      let saved = false;
      for (let i = 0; i < WHISPERX_MAX_POLLS; i++) {
        const poll = await pollWhisperXStep(started.predictionId);

        if (poll.status === "succeeded") {
          await saveTranscriptStep(asset, started.predictionId);
          saved = true;
          break;
        }

        if (
          poll.status === "failed" ||
          poll.status === "canceled" ||
          poll.status === "aborted"
        ) {
          const message = poll.error ?? `WhisperX ${poll.status}`;
          await markTranscriptFailedStep(asset.id, message);
          throw new FatalError(
            `WhisperX failed for ${asset.originalFilename ?? asset.id}: ${message}`,
          );
        }

        await sleep(WHISPERX_POLL_SLEEP);
      }

      if (!saved) {
        const message = "WhisperX timed out";
        await markTranscriptFailedStep(asset.id, message);
        throw new FatalError(
          `WhisperX timed out for ${asset.originalFilename ?? asset.id}`,
        );
      }
    }

    await finalizeStep(projectId);
  } catch (error) {
    const message =
      error instanceof FatalError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Create workflow failed";
    await markFailedStep(projectId, message);
    if (error instanceof FatalError) throw error;
    throw new FatalError(message);
  }
}

async function loadAssetsStep(projectId: string): Promise<CreateAssetRef[]> {
  "use step";
  return loadCreateAssets(projectId);
}

async function startWhisperXStep(asset: CreateAssetRef): Promise<{
  predictionId: string;
  alreadyReady: boolean;
}> {
  "use step";
  return startAssetWhisperX(asset);
}

async function pollWhisperXStep(predictionId: string): Promise<{
  status: string;
  error: string | null;
}> {
  "use step";
  const poll = await getWhisperXPrediction(predictionId);
  console.log(
    `[create] whisperx poll prediction=${predictionId} status=${poll.status}`,
  );
  return { status: poll.status, error: poll.error };
}

async function saveTranscriptStep(
  asset: CreateAssetRef,
  predictionId: string,
): Promise<void> {
  "use step";
  await saveAssetTranscript(asset, predictionId);
}

async function markTranscriptFailedStep(
  assetId: string,
  reason: string,
): Promise<void> {
  "use step";
  await markAssetTranscriptFailed(assetId, reason);
}

async function finalizeStep(projectId: string): Promise<void> {
  "use step";
  await finalizeCreateProject(projectId);
}

async function markFailedStep(projectId: string, reason: string): Promise<void> {
  "use step";
  await markCreateFailed(projectId, reason);
}
