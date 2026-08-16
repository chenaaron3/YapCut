/**
 * Vercel Workflow definition for project create.
 * Started when `USE_VERCEL_WORKFLOW=true` (see `startCreatePipeline`).
 *
 * WhisperX runs as a Replicate prediction; we poll across short steps with
 * `sleep()` so a long transcription cannot hit the function maxDuration.
 * Loudness/waveform: enqueue fal jobs, then poll across short steps with
 * `sleep()` (same pattern as WhisperX — no in-process subscribe loop).
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
} from "~/server/create/create-pipeline";
import {
  falJobProgress,
  measureStageEvent,
  transcribeStageEvent,
  whisperJobProgress,
} from "~/server/create/progress-estimate";
import { publishCreateProgress } from "~/server/create/publish-progress";
import {
  finishMeasureAssetJobs,
  pollMeasureAssetJobs,
  startMeasureAssetJobs,
} from "~/server/media/measure-asset";
import { FalMeasureError } from "~/server/media/measure-audio";
import { getWhisperXPrediction } from "~/server/transcribe/whisperx";

import type { CreateProgressEvent } from "~/domain/create-progress";
import type { CreateAssetRef } from "~/server/create/create-pipeline";
import type { MeasureJobSet } from "~/server/media/measure-asset";

/** Suspend between Replicate polls (no compute while sleeping). */
const WHISPERX_POLL_SLEEP = "15s";
/** ~30 minutes of wall time for a single asset transcription. */
const WHISPERX_MAX_POLLS = 120;
/** Suspend between fal loudnorm/waveform polls. */
const FAL_POLL_SLEEP = "5s";
/** ~10 minutes of wall time for one A-roll's fal jobs. */
const FAL_MAX_POLLS = 120;

export async function createProjectWorkflow(projectId: string) {
  "use workflow";

  try {
    const assets = await loadAssetsStep(projectId);
    const transcribeProgress = assets.map(() => 0);
    await emitProgressStep(projectId, transcribeStageEvent(transcribeProgress));

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i]!;
      const started = await startWhisperXStep(asset);
      if (started.alreadyReady) {
        transcribeProgress[i] = 1;
        await emitProgressStep(
          projectId,
          transcribeStageEvent(transcribeProgress),
        );
        continue;
      }

      let saved = false;
      for (let p = 0; p < WHISPERX_MAX_POLLS; p++) {
        const poll = await pollWhisperXStep({
          projectId,
          predictionId: started.predictionId,
          startedAtMs: started.startedAtMs,
          assetIndex: i,
          transcribeProgress,
        });
        transcribeProgress[i] = poll.assetProgress;
        if (poll.status === "succeeded") {
          await saveTranscriptStep(asset, started.predictionId);
          transcribeProgress[i] = 1;
          await emitProgressStep(
            projectId,
            transcribeStageEvent(transcribeProgress),
          );
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

    const measureProgress = assets.map(() => 0);
    await emitProgressStep(projectId, measureStageEvent(measureProgress));

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i]!;
      const started = await startMeasureStep(asset);
      let saved = false;
      for (let p = 0; p < FAL_MAX_POLLS; p++) {
        const poll = await pollMeasureStep({
          projectId,
          jobs: started.jobs,
          startedAtMs: started.startedAtMs,
          assetIndex: i,
          measureProgress,
        });
        measureProgress[i] = poll.assetProgress;
        if (poll.done) {
          await finishMeasureStep(started.jobs);
          measureProgress[i] = 1;
          await emitProgressStep(projectId, measureStageEvent(measureProgress));
          saved = true;
          break;
        }
        await sleep(FAL_POLL_SLEEP);
      }
      if (!saved) {
        throw new FatalError(
          `fal measure timed out for ${asset.originalFilename ?? asset.id}`,
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

async function emitProgressStep(
  projectId: string,
  event: CreateProgressEvent,
): Promise<void> {
  "use step";
  await publishCreateProgress(projectId, event);
}

async function loadAssetsStep(projectId: string): Promise<CreateAssetRef[]> {
  "use step";
  return loadCreateAssets(projectId);
}

async function startWhisperXStep(asset: CreateAssetRef): Promise<{
  predictionId: string;
  alreadyReady: boolean;
  startedAtMs: number;
}> {
  "use step";
  const started = await startAssetWhisperX(asset);
  return { ...started, startedAtMs: Date.now() };
}

async function pollWhisperXStep(input: {
  projectId: string;
  predictionId: string;
  startedAtMs: number;
  assetIndex: number;
  transcribeProgress: number[];
}): Promise<{
  status: string;
  error: string | null;
  assetProgress: number;
}> {
  "use step";
  const poll = await getWhisperXPrediction(input.predictionId);
  console.log(
    `[create] whisperx poll prediction=${input.predictionId} status=${poll.status}`,
  );
  const parts = [...input.transcribeProgress];
  const assetProgress = whisperJobProgress(
    poll.status,
    input.startedAtMs,
    Date.now(),
  );
  parts[input.assetIndex] = assetProgress;
  await publishCreateProgress(input.projectId, transcribeStageEvent(parts));
  return { status: poll.status, error: poll.error, assetProgress };
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

async function startMeasureStep(asset: CreateAssetRef): Promise<{
  jobs: MeasureJobSet;
  startedAtMs: number;
}> {
  "use step";
  try {
    const jobs = await startMeasureAssetJobs(asset);
    return { jobs, startedAtMs: Date.now() };
  } catch (error) {
    if (error instanceof FalMeasureError && error.fatal) {
      throw new FatalError(error.message);
    }
    throw error;
  }
}

async function pollMeasureStep(input: {
  projectId: string;
  jobs: MeasureJobSet;
  startedAtMs: number;
  assetIndex: number;
  measureProgress: number[];
}): Promise<{ done: boolean; assetProgress: number }> {
  "use step";
  try {
    const poll = await pollMeasureAssetJobs(input.jobs);
    const assetProgress =
      (falJobProgress(poll.loudnorm, input.startedAtMs, Date.now()) +
        falJobProgress(poll.waveform, input.startedAtMs, Date.now())) /
      2;
    const parts = [...input.measureProgress];
    parts[input.assetIndex] = assetProgress;
    await publishCreateProgress(input.projectId, measureStageEvent(parts));
    return { done: poll.done, assetProgress };
  } catch (error) {
    if (error instanceof FalMeasureError && error.fatal) {
      throw new FatalError(error.message);
    }
    throw error;
  }
}

async function finishMeasureStep(jobs: MeasureJobSet): Promise<void> {
  "use step";
  try {
    await finishMeasureAssetJobs(jobs);
  } catch (error) {
    if (error instanceof FalMeasureError && error.fatal) {
      throw new FatalError(error.message);
    }
    throw error;
  }
}

async function finalizeStep(projectId: string): Promise<void> {
  "use step";
  await finalizeCreateProject(projectId);
}

async function markFailedStep(
  projectId: string,
  reason: string,
): Promise<void> {
  "use step";
  await markCreateFailed(projectId, reason);
}
